export async function loadDataJson(fileName) {
    const url = new URL(`../../data/json/${fileName}`, import.meta.url);

    if (typeof window === 'undefined') {
        const { readFile } = await import('node:fs/promises');
        const raw = await readFile(url, 'utf8');
        return JSON.parse(raw);
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load data JSON: ${fileName} (${response.status})`);
    }
    return response.json();
}
