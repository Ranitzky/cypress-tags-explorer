// ── Tag Expression Parser ──────────────────────────────────────────────────────
// Grammar:
//   expr     = or_expr
//   or_expr  = and_expr ( ('OR' | implicit-space) and_expr )*
//   and_expr = not_expr ( 'AND' not_expr )*
//   not_expr = 'NOT' not_expr | atom
//   atom     = '(' expr ')' | TAG
//
// Operators:
//   AND  – keyword or legacy '+'
//   OR   – keyword or legacy space
//   NOT  – keyword or legacy '-' prefix on a tag
//   ()   – grouping at any nesting depth

type TagTokType = 'TAG' | 'AND' | 'OR' | 'NOT' | 'LP' | 'RP' | 'EOF';
interface TagTok { type: TagTokType; value: string; }
type TagPred = (tags: string[]) => boolean;

export function tokenizeTagExpr(expr: string): TagTok[] {
    const tokens: TagTok[] = [];
    // Match: (, ), +, or any non-whitespace/paren/+ run
    const re = /\(|\)|[^\s()+]+|\+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(expr)) !== null) {
        const v = m[0];
        if (v === '(')                { tokens.push({ type: 'LP',  value: v }); continue; }
        if (v === ')')                { tokens.push({ type: 'RP',  value: v }); continue; }
        if (v === '+')                { tokens.push({ type: 'AND', value: 'AND' }); continue; }
        if (/^AND$/i.test(v))         { tokens.push({ type: 'AND', value: 'AND' }); continue; }
        if (/^OR$/i.test(v))          { tokens.push({ type: 'OR',  value: 'OR'  }); continue; }
        if (/^NOT$/i.test(v))         { tokens.push({ type: 'NOT', value: 'NOT' }); continue; }
        tokens.push({ type: 'TAG', value: v });
    }
    tokens.push({ type: 'EOF', value: '' });
    return tokens;
}

export class TagExprParser {
    private tokens: TagTok[];
    private pos = 0;

    constructor(tokens: TagTok[]) { this.tokens = tokens; }

    private peek(): TagTok { return this.tokens[this.pos]; }
    private consume(): TagTok { return this.tokens[this.pos++]; }

    parse(): TagPred { return this.parseOr(); }

    // or_expr: and_expr ( ('OR' | implicit) and_expr )*
    private parseOr(): TagPred {
        let left = this.parseAnd();
        while (true) {
            const t = this.peek();
            if (t.type === 'OR') {
                this.consume();
                const right = this.parseAnd();
                const l = left, r = right;
                left = (tags) => l(tags) || r(tags);
            } else if (t.type === 'TAG' || t.type === 'NOT' || t.type === 'LP') {
                // implicit OR: legacy space-separated behaviour
                const right = this.parseAnd();
                const l = left, r = right;
                left = (tags) => l(tags) || r(tags);
            } else {
                break;
            }
        }
        return left;
    }

    // and_expr: not_expr ( 'AND' not_expr )*
    private parseAnd(): TagPred {
        let left = this.parseNot();
        while (this.peek().type === 'AND') {
            this.consume();
            const right = this.parseNot();
            const l = left, r = right;
            left = (tags) => l(tags) && r(tags);
        }
        return left;
    }

    // not_expr: 'NOT' not_expr | atom
    private parseNot(): TagPred {
        if (this.peek().type === 'NOT') {
            this.consume();
            const inner = this.parseNot();
            return (tags) => !inner(tags);
        }
        return this.parseAtom();
    }

    // atom: '(' expr ')' | TAG
    private parseAtom(): TagPred {
        const t = this.peek();
        if (t.type === 'LP') {
            this.consume();
            const inner = this.parseOr();
            if (this.peek().type === 'RP') this.consume();
            return inner;
        }
        if (t.type === 'TAG') {
            this.consume();
            let name = t.value;
            let negate = false;
            if (name.startsWith('-')) { negate = true; name = name.slice(1); }
            const lower = name.toLowerCase();
            const match = (tags: string[]) =>
                tags.some(tag => tag.toLowerCase() === lower || tag.toLowerCase().includes(lower));
            return negate ? (tags) => !match(tags) : match;
        }
        // EOF or unexpected → vacuously true
        return () => true;
    }
}

export function matchesTagExpression(testTags: string[], expr: string): boolean {
    if (!expr.trim()) return true;
    const tokens = tokenizeTagExpr(expr);
    const pred = new TagExprParser(tokens).parse();
    return pred(testTags);
}
