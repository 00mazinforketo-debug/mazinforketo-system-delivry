import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

type TextEditorScope = 'admin' | 'captain' | 'employee';
type EditableTextKind = 'literal' | 'template' | 'jsx';

interface EditableTextEntry {
  id: string;
  file: string;
  line: number;
  kind: EditableTextKind;
  text: string;
}

interface EditableTextEntryWithRange extends EditableTextEntry {
  start: number;
  end: number;
  quote: '"' | "'" | '`' | null;
}

interface EditableTextResponse {
  scope: TextEditorScope;
  label: string;
  filesCount: number;
  generatedAt: string;
  entries: EditableTextEntry[];
}

interface EditableTextSaveResponse extends EditableTextResponse {
  savedCount: number;
  changedFiles: string[];
}

interface ProjectSearchPreview {
  line: number;
  text: string;
}

interface ProjectSearchMatch {
  file: string;
  occurrences: number;
  previews: ProjectSearchPreview[];
}

interface ProjectSearchResponse {
  query: string;
  filesCount: number;
  matchCount: number;
  generatedAt: string;
  matches: ProjectSearchMatch[];
}

interface ProjectReplaceResponse {
  searchText: string;
  replaceText: string;
  filesCount: number;
  replacedCount: number;
  changedFiles: string[];
}

interface SaveRequestPayload {
  scope: TextEditorScope;
  updates: Array<{
    id: string;
    text: string;
  }>;
}

interface ProjectSearchPayload {
  query: string;
}

interface ProjectReplacePayload {
  searchText: string;
  replaceText: string;
}

const scopeConfigs: Record<TextEditorScope, { label: string; targets: string[] }> = {
  admin: {
    label: 'ئادمێن',
    targets: [
      'src/features/admin',
      'src/features/delivery/AdminDeliveryOrdersPage.tsx',
      'src/features/orders/OrderDetailsPage.tsx',
      'src/features/delivery/DeliveryOrderDetailsPage.tsx',
      'src/components/shared/DashboardShell.tsx',
      'src/config/navigation.ts',
    ],
  },
  captain: {
    label: 'کاپتن',
    targets: [
      'src/features/captain',
      'src/features/delivery/CaptainDeliveryPage.tsx',
      'src/features/orders/OrderDetailsPage.tsx',
      'src/features/delivery/DeliveryOrderDetailsPage.tsx',
      'src/config/navigation.ts',
    ],
  },
  employee: {
    label: 'کارمەند',
    targets: [
      'src/features/employee',
      'src/features/delivery/EmployeeDeliveryOrdersPage.tsx',
      'src/features/orders/OrderDetailsPage.tsx',
      'src/features/delivery/DeliveryOrderDetailsPage.tsx',
    ],
  },
};

const supportedExtensions = new Set(['.ts', '.tsx']);
const projectSearchTargets = ['src', 'worker/src', 'shared', 'vite.config.ts', 'wrangler.jsonc'] as const;
const projectSearchExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.jsonc', '.css', '.html']);
const reservedNonUiValues = new Set([
  'success',
  'error',
  'info',
  'primary',
  'secondary',
  'ghost',
  'danger',
  'orders',
  'notifications',
  'deliveryOrders',
  'reset-performed',
  'settings-changed',
  'order-created',
  'order-updated',
  'delivery-order-created',
  'delivery-order-updated',
  'notification-changed',
  'delivery-notification-changed',
  'pending_captain',
  'accepted',
  'completed',
  'cancelled',
  'admin',
  'captain',
  'employee',
]);
const nonUiNamePattern =
  /^(?:to|path|className|tone|variant|status|type|icon|id|name|method|role|scope|size|key|queryKey|pollIntervalMs|backgroundPollIntervalMs|redirectTo)$/i;
const uiNamePattern = /(?:title|label|description|badge|eyebrow|message|hint|placeholder|summary|note)$/i;

const normalizePath = (value: string) => value.replace(/\\/g, '/');

const getNameText = (name: ts.PropertyName | ts.JsxAttributeName): string | null => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
};

const isUiName = (value: string) => value === 'aria-label' || value === 'alt' || uiNamePattern.test(value);

const isUtilityClassText = (value: string) => {
  const tokens = value.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return false;
  }

  const utilityPrefixPattern =
    /^(?:bg|text|border|from|to|via|rounded|shadow|grid|flex|gap|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|min|max|w|h|justify|items|content|overflow|sticky|absolute|relative|fixed|top|left|right|bottom|z|col|row|font|tracking|leading|transition|hover|focus|sm:|md:|lg:|xl:|2xl:)/i;

  return (
    tokens.every((token) => /^[a-z0-9:_[\]/%.().-]+$/i.test(token)) &&
    tokens.some((token) => utilityPrefixPattern.test(token))
  );
};

const isPathLikeText = (value: string) => {
  if (/^(?:\/|\.{1,2}[\\/])/.test(value)) {
    return true;
  }

  if (/^(?:https?:|data:|app:\/\/|plugin:\/\/)/i.test(value)) {
    return true;
  }

  if (/\.(?:ts|tsx|js|jsx|json|png|jpg|jpeg|svg|webp)$/i.test(value)) {
    return true;
  }

  return /^[\w@.-]+(?:\/[\w@./-]+)+$/i.test(value);
};

const looksLikeHumanText = (value: string, force: boolean) => {
  if (!/[\p{L}\p{N}]/u.test(value)) {
    return false;
  }

  if (force) {
    return true;
  }

  return /[\u0600-\u06FF]/u.test(value) || /\s/u.test(value) || /[A-Z]/.test(value);
};

const normalizeLiteralText = (value: string) => value.replace(/\r\n/g, '\n').trim();

const normalizeJsxText = (value: string) =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const isVisibleSchemaMessage = (node: ts.Node, sourceFile: ts.SourceFile) => {
  const parent = node.parent;
  if (!ts.isCallExpression(parent) || !ts.isPropertyAccessExpression(parent.expression)) {
    return false;
  }

  const methodName = parent.expression.name.text;
  const argumentIndex = parent.arguments.findIndex((argument) => argument === node);
  if (argumentIndex < 1) {
    return false;
  }

  return ['min', 'max', 'length', 'email', 'regex', 'refine', 'nonempty', 'uuid', 'url'].includes(methodName) &&
    parent.expression.expression.getText(sourceFile).length > 0;
};

const hasVisibleJsxExpressionAncestor = (node: ts.Node) => {
  let current: ts.Node | undefined = node.parent;

  while (current) {
    if (ts.isJsxAttribute(current)) {
      return false;
    }

    if (ts.isJsxExpression(current)) {
      return true;
    }

    if (ts.isSourceFile(current)) {
      return false;
    }

    current = current.parent;
  }

  return false;
};

const shouldIncludeText = (node: ts.Node, text: string, sourceFile: ts.SourceFile) => {
  if (!text || reservedNonUiValues.has(text) || isPathLikeText(text) || isUtilityClassText(text)) {
    return false;
  }

  const parent = node.parent;
  if (!parent) {
    return false;
  }

  let forceVisible = false;

  if (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isExternalModuleReference(parent) ||
    ts.isLiteralTypeNode(parent)
  ) {
    return false;
  }

  if (ts.isJsxAttribute(parent)) {
    const name = getNameText(parent.name);
    if (!name || !isUiName(name)) {
      return false;
    }

    forceVisible = true;
  } else if (ts.isPropertyAssignment(parent)) {
    const name = getNameText(parent.name);
    if (!name || nonUiNamePattern.test(name) || !isUiName(name)) {
      return false;
    }

    forceVisible = true;
  } else if (ts.isCallExpression(parent)) {
    const expressionText = parent.expression.getText(sourceFile);
    if (expressionText.endsWith('showToast') || isVisibleSchemaMessage(node, sourceFile)) {
      forceVisible = true;
    } else {
      return false;
    }
  } else if (ts.isNewExpression(parent)) {
    if (parent.expression.getText(sourceFile).endsWith('Error')) {
      forceVisible = true;
    } else {
      return false;
    }
  } else if (hasVisibleJsxExpressionAncestor(node)) {
    forceVisible = true;
  } else {
    return false;
  }

  return looksLikeHumanText(text, forceVisible);
};

const escapeStringLiteralText = (value: string, quote: '"' | "'" | '`') => {
  let escaped = value.replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

  if (quote === "'") {
    escaped = escaped.replace(/'/g, "\\'");
  } else if (quote === '"') {
    escaped = escaped.replace(/"/g, '\\"');
  } else {
    escaped = escaped.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  }

  return escaped;
};

const collectFilesFromTargets = (rootDir: string, targets: readonly string[], extensions: ReadonlySet<string>) => {
  const files = new Set<string>();

  const visitTarget = (absoluteTarget: string) => {
    if (!fs.existsSync(absoluteTarget)) {
      return;
    }

    const stat = fs.statSync(absoluteTarget);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absoluteTarget, { withFileTypes: true })) {
        visitTarget(path.join(absoluteTarget, child.name));
      }
      return;
    }

    if (extensions.has(path.extname(absoluteTarget))) {
      files.add(path.resolve(absoluteTarget));
    }
  };

  for (const target of targets) {
    visitTarget(path.resolve(rootDir, target));
  }

  return [...files].sort((left, right) => left.localeCompare(right));
};

const collectSourceFiles = (rootDir: string, scope: TextEditorScope) => {
  return collectFilesFromTargets(rootDir, scopeConfigs[scope].targets, supportedExtensions);
};

const collectFileEntries = (rootDir: string, filePath: string) => {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
  const relativeFile = normalizePath(path.relative(rootDir, filePath));
  const entries: EditableTextEntryWithRange[] = [];
  const seenIds = new Set<string>();

  const pushEntry = (
    kind: EditableTextKind,
    start: number,
    end: number,
    text: string,
    quote: EditableTextEntryWithRange['quote'],
  ) => {
    if (start >= end || text.length === 0) {
      return;
    }

    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    const id = `${relativeFile}:${start}:${kind}`;
    if (seenIds.has(id)) {
      return;
    }

    seenIds.add(id);
    entries.push({
      id,
      file: relativeFile,
      line,
      kind,
      text,
      start,
      end,
      quote,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node)) {
      const text = normalizeLiteralText(node.text);
      if (shouldIncludeText(node, text, sourceFile)) {
        const start = node.getStart(sourceFile) + 1;
        const quote = sourceText[node.getStart(sourceFile)] as EditableTextEntryWithRange['quote'];
        pushEntry('literal', start, node.getEnd() - 1, text, quote);
      }
    } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = normalizeLiteralText(node.text);
      if (shouldIncludeText(node, text, sourceFile)) {
        pushEntry('template', node.getStart(sourceFile) + 1, node.getEnd() - 1, text, '`');
      }
    } else if (ts.isJsxText(node)) {
      const rawText = sourceText.slice(node.pos, node.end);
      const leadingWhitespaceLength = rawText.match(/^\s*/u)?.[0].length ?? 0;
      const trailingWhitespaceLength = rawText.match(/\s*$/u)?.[0].length ?? 0;
      const rawContent = rawText.slice(leadingWhitespaceLength, rawText.length - trailingWhitespaceLength);
      const text = normalizeJsxText(rawContent);

      if (shouldIncludeText(node, text, sourceFile)) {
        pushEntry('jsx', node.pos + leadingWhitespaceLength, node.end - trailingWhitespaceLength, text, null);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return entries;
};

const collectEditableTextEntries = (rootDir: string, scope: TextEditorScope) =>
  collectSourceFiles(rootDir, scope)
    .flatMap((filePath) => collectFileEntries(rootDir, filePath))
    .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.start - right.start);

export const collectEditableTexts = (rootDir: string, scope: TextEditorScope): EditableTextResponse => {
  const entries = collectEditableTextEntries(rootDir, scope);
  const fileCount = new Set(entries.map((entry) => entry.file)).size;
  const publicEntries = entries.map((entry) => ({
    id: entry.id,
    file: entry.file,
    line: entry.line,
    kind: entry.kind,
    text: entry.text,
  }));

  return {
    scope,
    label: scopeConfigs[scope].label,
    filesCount: fileCount,
    generatedAt: new Date().toISOString(),
    entries: publicEntries,
  };
};

const countOccurrences = (sourceText: string, query: string) => {
  if (!query) {
    return 0;
  }

  let count = 0;
  let searchIndex = 0;

  while (searchIndex < sourceText.length) {
    const foundIndex = sourceText.indexOf(query, searchIndex);
    if (foundIndex < 0) {
      break;
    }

    count += 1;
    searchIndex = foundIndex + Math.max(query.length, 1);
  }

  return count;
};

const getLineNumberAtIndex = (sourceText: string, index: number) => sourceText.slice(0, index).split('\n').length;

const getLineTextAtIndex = (sourceText: string, index: number) => {
  const lineStart = sourceText.lastIndexOf('\n', index - 1) + 1;
  const nextLineBreak = sourceText.indexOf('\n', index);
  const lineEnd = nextLineBreak < 0 ? sourceText.length : nextLineBreak;
  return sourceText.slice(lineStart, lineEnd).trim();
};

const searchProjectTexts = (rootDir: string, query: string): ProjectSearchResponse => {
  const normalizedQuery = query.replace(/\r\n/g, '\n');
  if (!normalizedQuery.trim()) {
    throw new Error('تێکستی گەڕان پێویستە.');
  }

  const matches: ProjectSearchMatch[] = [];
  let matchCount = 0;

  for (const filePath of collectFilesFromTargets(rootDir, projectSearchTargets, projectSearchExtensions)) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    if (!sourceText.includes(normalizedQuery)) {
      continue;
    }

    const relativeFile = normalizePath(path.relative(rootDir, filePath));
    const previews: ProjectSearchPreview[] = [];
    let occurrences = 0;
    let searchIndex = 0;

    while (searchIndex < sourceText.length) {
      const foundIndex = sourceText.indexOf(normalizedQuery, searchIndex);
      if (foundIndex < 0) {
        break;
      }

      occurrences += 1;
      if (previews.length < 3) {
        previews.push({
          line: getLineNumberAtIndex(sourceText, foundIndex),
          text: getLineTextAtIndex(sourceText, foundIndex),
        });
      }
      searchIndex = foundIndex + Math.max(normalizedQuery.length, 1);
    }

    matchCount += occurrences;
    matches.push({
      file: relativeFile,
      occurrences,
      previews,
    });
  }

  return {
    query: normalizedQuery,
    filesCount: matches.length,
    matchCount,
    generatedAt: new Date().toISOString(),
    matches,
  };
};

const replaceProjectTexts = (rootDir: string, searchText: string, replaceText: string): ProjectReplaceResponse => {
  const normalizedSearchText = searchText.replace(/\r\n/g, '\n');
  const normalizedReplaceText = replaceText.replace(/\r\n/g, '\n');
  if (!normalizedSearchText.trim()) {
    throw new Error('تێکستی گەڕان پێویستە.');
  }

  const changedFiles: string[] = [];
  let replacedCount = 0;

  for (const filePath of collectFilesFromTargets(rootDir, projectSearchTargets, projectSearchExtensions)) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const occurrences = countOccurrences(sourceText, normalizedSearchText);
    if (occurrences === 0) {
      continue;
    }

    const nextSourceText = sourceText.split(normalizedSearchText).join(normalizedReplaceText);
    fs.writeFileSync(filePath, nextSourceText, 'utf8');
    changedFiles.push(normalizePath(path.relative(rootDir, filePath)));
    replacedCount += occurrences;
  }

  return {
    searchText: normalizedSearchText,
    replaceText: normalizedReplaceText,
    filesCount: changedFiles.length,
    replacedCount,
    changedFiles: changedFiles.sort((left, right) => left.localeCompare(right)),
  };
};

const saveEditableTexts = (rootDir: string, scope: TextEditorScope, updates: SaveRequestPayload['updates']): EditableTextSaveResponse => {
  const scopedEntries = collectEditableTextEntries(rootDir, scope);
  const entriesById = new Map(scopedEntries.map((entry) => [entry.id, entry]));
  const changesByFile = new Map<string, Array<{ start: number; end: number; replacement: string }>>();
  const changedFiles = new Set<string>();
  let savedCount = 0;

  for (const update of updates) {
    if (typeof update.id !== 'string' || typeof update.text !== 'string') {
      throw new Error('فۆرماتی تێکستەکان دروست نییە.');
    }

    const entry = entriesById.get(update.id);
    if (!entry) {
      throw new Error('هەندێک لە تێکستەکان گۆڕاوە یان نەدۆزرایەوە. دووبارە لیستەکە نوێ بکەرەوە.');
    }

    const nextText = update.text.replace(/\r\n/g, '\n');
    if (nextText === entry.text) {
      continue;
    }

    if (entry.kind === 'jsx' && /[{}<>]/.test(nextText)) {
      throw new Error('لە JSX text ـدا ناتوانیت `<`, `>`, `{`, `}` بەکاربهێنیت. بۆ ئەم جۆرە تێکستانە تەنها دەق بنووسە.');
    }

    const replacement =
      entry.kind === 'jsx'
        ? nextText
        : escapeStringLiteralText(nextText, entry.quote ?? '"');

    if (!changesByFile.has(entry.file)) {
      changesByFile.set(entry.file, []);
    }

    changesByFile.get(entry.file)?.push({
      start: entry.start,
      end: entry.end,
      replacement,
    });
    changedFiles.add(entry.file);
    savedCount += 1;
  }

  for (const [relativeFile, changes] of changesByFile.entries()) {
    const absoluteFile = path.resolve(rootDir, relativeFile);
    let sourceText = fs.readFileSync(absoluteFile, 'utf8');

    changes.sort((left, right) => right.start - left.start);
    for (const change of changes) {
      sourceText = `${sourceText.slice(0, change.start)}${change.replacement}${sourceText.slice(change.end)}`;
    }

    fs.writeFileSync(absoluteFile, sourceText, 'utf8');
  }

  const refreshed = collectEditableTexts(rootDir, scope);
  return {
    ...refreshed,
    savedCount,
    changedFiles: [...changedFiles].sort((left, right) => left.localeCompare(right)),
  };
};

const readRequestBody = async <T>(request: NodeJS.ReadableStream) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) {
    return null as T | null;
  }

  return JSON.parse(text) as T;
};

const sendJson = (response: import('node:http').ServerResponse, statusCode: number, payload: unknown) => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const isTextEditorScope = (value: string): value is TextEditorScope => value === 'admin' || value === 'captain' || value === 'employee';

export const devTextEditorPlugin = (rootDir: string): Plugin => ({
  name: 'dev-text-editor',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url) {
        next();
        return;
      }

      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith('/__dev/text-editor')) {
        next();
        return;
      }

      try {
        if (url.pathname === '/__dev/text-editor' && request.method === 'GET') {
          const scope = url.searchParams.get('scope');
          if (!scope || !isTextEditorScope(scope)) {
            sendJson(response, 400, { success: false, error: { message: 'scope ی نادروست نێردرا.' } });
            return;
          }

          sendJson(response, 200, {
            success: true,
            data: collectEditableTexts(rootDir, scope),
          });
          return;
        }

        if (url.pathname === '/__dev/text-editor' && request.method === 'PUT') {
          const payload = await readRequestBody<SaveRequestPayload>(request);
          if (!payload || !isTextEditorScope(payload.scope) || !Array.isArray(payload.updates)) {
            sendJson(response, 400, { success: false, error: { message: 'داواکارییەکە دروست نییە.' } });
            return;
          }

          sendJson(response, 200, {
            success: true,
            data: saveEditableTexts(rootDir, payload.scope, payload.updates),
          });
          return;
        }

        if (url.pathname === '/__dev/text-editor/project-search' && request.method === 'POST') {
          const payload = await readRequestBody<ProjectSearchPayload>(request);
          if (!payload || typeof payload.query !== 'string') {
            sendJson(response, 400, { success: false, error: { message: 'تێکستی گەڕان دروست نییە.' } });
            return;
          }

          sendJson(response, 200, {
            success: true,
            data: searchProjectTexts(rootDir, payload.query),
          });
          return;
        }

        if (url.pathname === '/__dev/text-editor/project-replace' && request.method === 'POST') {
          const payload = await readRequestBody<ProjectReplacePayload>(request);
          if (!payload || typeof payload.searchText !== 'string' || typeof payload.replaceText !== 'string') {
            sendJson(response, 400, { success: false, error: { message: 'زانیاریی replace دروست نییە.' } });
            return;
          }

          sendJson(response, 200, {
            success: true,
            data: replaceProjectTexts(rootDir, payload.searchText, payload.replaceText),
          });
          return;
        }

        sendJson(response, 405, { success: false, error: { message: 'ئەم ڕێگایە پشتگیری ناکرێت.' } });
      } catch (caughtError) {
        sendJson(response, 500, {
          success: false,
          error: {
            message: caughtError instanceof Error ? caughtError.message : 'هەڵەیەک ڕوویدا.',
          },
        });
      }
    });
  },
});
