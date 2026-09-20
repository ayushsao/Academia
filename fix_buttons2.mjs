import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const walkSync = function (dir, filelist) {
    let files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
        if (fs.statSync(dir + '/' + file).isDirectory()) {
            filelist = walkSync(dir + '/' + file, filelist);
        }
        else {
            if (file.endsWith('.tsx')) {
                filelist.push(dir + '/' + file);
            }
        }
    });
    return filelist;
};

const srcPath = path.join(__dirname, 'src');
const files = walkSync(srcPath);

let modifiedButtons = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;

    // A bit more robust regex to catch rounded-* classes in className within button/a/Link 
    content = content.replace(/(<(?:button|a|Link)[^>]*?className=\{?["'`].*?)rounded-(?:full|sm|md|lg|xl|2xl|3xl|\[.*?\])(.*?["'`]\}?>)/g, (match, prefix, suffix) => {
        // Only if it has padding classes (which means it's a real button, not an icon button usually)
        if (match.includes('px-') || match.includes('py-')) {
            modifiedButtons++;
            return prefix + 'rounded-[12px]' + suffix;
        }
        return match;
    });

    if (content !== originalContent) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Modified buttons:', modifiedButtons);
