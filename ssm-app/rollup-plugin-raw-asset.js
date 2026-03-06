import fs from 'fs';

export default function rawAsset(extensions) {
  const filter = new RegExp(`\\.(${extensions.join('|')})$`);

  return {
    name: 'raw-asset',
    async load(id) {
      // Check if the file matches the desired extensions
      if (filter.test(id)) {
        // Read the file content asynchronously
        const content = await fs.promises.readFile(id, 'utf-8');
        // Return the content wrapped as a default export string
        return `export default ${JSON.stringify(content)};`;
      }
      return null; // Let other plugins handle the file
    }
  };
}
