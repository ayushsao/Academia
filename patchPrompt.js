import fs from 'fs';

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Find where setIsToolProcessing(true) starts
    const splitKey = "        setIsToolProcessing(true);\n";
    const bodyKey = "body: JSON.stringify({ prompt: toolInput })";
    const languageToolKey = "text: toolInput,";

    if (content.includes(splitKey) && content.includes(bodyKey)) {
        const insertion = `        let finalPrompt = toolInput.trim();
        if (slug === 'referencing-tool') {
            finalPrompt = \`Please generate an academic citation. Details: Author: \${customForm.author || 'N/A'}, Year: \${customForm.year || 'N/A'}, Title: \${customForm.title || 'N/A'}, Publisher/URL: \${customForm.url || 'N/A'}\`;
        } else if (slug === 'free-thesis-statement-generator' || slug === 'free-dissertation-outline-generator') {
            finalPrompt = \`Tool: \${slug}\\nPlease process this.\\nTopic: \${customForm.topic || 'N/A'}.\\nMain Argument: \${customForm.argument || 'N/A'}.\\nSupporting points: 1) \${customForm.point1 || 'N/A'} 2) \${customForm.point2 || 'N/A'} 3) \${customForm.point3 || 'N/A'}\`;
        }
        
        if (!finalPrompt) return setToolError('Prompt is required.');

`;
        content = content.replace(splitKey, insertion + splitKey);
        content = content.replace(bodyKey, "body: JSON.stringify({ prompt: finalPrompt })");
        content = content.replace(languageToolKey, "text: finalPrompt,");

        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Fixed prompt logic!');
    } else {
        console.log("Could not find hooks");
    }

}

fixFile('src/pages/DynamicPage.tsx');
