import fs from 'fs';

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // For DynamicPage.tsx
    let searchStr = "const baseApi = (import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api');";
    let replaceStr = "const baseApi = String((import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api')).trim();";

    if (content.includes(searchStr)) {
        content = content.replace(searchStr, replaceStr);
    }

    // For other files
    searchStr = "const API = ((import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api')).replace(/\\/+$/, '');";
    replaceStr = "const API = String((import.meta as any).env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://academia-iw7x.onrender.com/api')).trim().replace(/\\/+$/, '');";

    if (content.includes(searchStr)) {
        content = content.replace(searchStr, replaceStr);
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

fixFile('src/pages/DynamicPage.tsx');
fixFile('src/components/OrderModal.tsx');
fixFile('src/pages/Dashboard.tsx');
fixFile('src/components/SignInModal.tsx');
fixFile('src/pages/AdminPanel.tsx');
