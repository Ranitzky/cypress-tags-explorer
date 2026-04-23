export interface TagNode {
    tag: string;
    tests: any[];
    children: TagNode[];
}

export function buildTagTree(flatTests: any[], viewAsTree: boolean): TagNode[] {
    const tagMap = new Map<string, any[]>();
    for (const test of flatTests) {
        if (test.tags && test.tags.length > 0) {
            for (const tag of test.tags) {
                if (!tagMap.has(tag)) tagMap.set(tag, []);
                tagMap.get(tag)!.push(test);
            }
        } else if (test.type === 'it') {
            if (!tagMap.has('[Untagged]')) tagMap.set('[Untagged]', []);
            tagMap.get('[Untagged]')!.push(test);
        }
    }

    const allTags = Array.from(tagMap.keys()).sort();
    const tagNodes = new Map<string, TagNode>();

    for (const tag of allTags) {
        tagNodes.set(tag, { tag, tests: tagMap.get(tag)!, children: [] });
    }

    if (!viewAsTree) {
        return Array.from(tagNodes.values());
    }

    // Infer hierarchy based on subset relationship
    // B is a child of A if tests(B) is a strict subset of tests(A), or if tests(B) == tests(A) and A < B
    const getTestIds = (tag: string) => {
        const tests = tagMap.get(tag)!;
        return new Set(tests.map(t => `${t.filePath}:${t.line}`));
    };

    const tagTests = new Map<string, Set<string>>();
    for (const tag of allTags) {
        tagTests.set(tag, getTestIds(tag));
    }

    const roots: TagNode[] = [];

    for (const tag of allTags) {
        let bestParent: string | null = null;
        let bestParentSize = Infinity;
        const myTests = tagTests.get(tag)!;

        for (const candidate of allTags) {
            if (candidate === tag) continue;
            const candidateTests = tagTests.get(candidate)!;

            // Check if myTests is a subset of candidateTests
            let isSubset = true;
            for (const id of myTests) {
                if (!candidateTests.has(id)) {
                    isSubset = false;
                    break;
                }
            }

            if (isSubset) {
                // If they are exactly equal, resolve by alphabetical order to prevent cycles
                if (myTests.size === candidateTests.size && candidate > tag) {
                    continue; // tag will be the parent of candidate instead
                }

                if (candidateTests.size < bestParentSize) {
                    bestParent = candidate;
                    bestParentSize = candidateTests.size;
                }
            }
        }

        if (bestParent) {
            tagNodes.get(bestParent)!.children.push(tagNodes.get(tag)!);
        } else {
            roots.push(tagNodes.get(tag)!);
        }
    }

    return roots;
}
