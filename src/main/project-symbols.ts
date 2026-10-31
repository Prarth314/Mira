import { parse } from '@babel/parser';
import type { ContextAttachment } from '../types/studio';
import type { ProjectSymbol } from '../types/vocabulary';

/** Parse only explicitly attached snapshots. No repository-wide content reads. */
export function projectSymbols(files: ContextAttachment[]): ProjectSymbol[] {
  const symbols: ProjectSymbol[] = [];
  for (const file of files.slice(0, 3)) {
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(file.path) || file.content.length > 24_000) continue;
    try {
      const ast = parse(file.content, {
        sourceType: 'unambiguous',
        plugins: [
          ...(/\.(?:tsx?|[cm]ts)$/i.test(file.path) ? ['typescript' as const] : []),
          ...(/\.[jt]sx$/i.test(file.path) ? ['jsx' as const] : []),
        ],
      });
      const names = new Set<string>();
      for (const statement of ast.program.body) {
        const node =
          statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportDefaultDeclaration'
            ? statement.declaration
            : statement;
        if (!node) continue;
        if (node.type === 'VariableDeclaration') {
          for (const declaration of node.declarations) {
            if (declaration.id.type === 'Identifier') names.add(declaration.id.name);
          }
        } else if (
          node.type === 'FunctionDeclaration' ||
          node.type === 'ClassDeclaration' ||
          node.type === 'TSInterfaceDeclaration' ||
          node.type === 'TSTypeAliasDeclaration' ||
          node.type === 'TSEnumDeclaration' ||
          node.type === 'TSDeclareFunction'
        ) {
          if (node.id) names.add(node.id.name);
        }
      }
      for (const name of [...names].slice(0, 200)) {
        if (/^[A-Za-z_$][A-Za-z0-9_$]{1,99}$/.test(name)) symbols.push({ name, path: file.path });
      }
    } catch {
      // Incomplete or unsupported syntax supplies no hints, rather than regex guesses.
    }
  }
  return symbols;
}
