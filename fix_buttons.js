const fs = require('fs');
const path = require('path');

const walkSync = function (dir, filelist) {
    files = fs.readdirSync(dir);
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

    // Regex to match <button ... className="... rounded-md|rounded-full|rounded-3xl|rounded-xl ..."> ... </button>
    // We'll just look for className="... 
    // It's safer to just look at any className that contains bg-..., px-..., py-... and a rounded-... inside a button or header Link.

    content = content.replace(/(<(?:button|a|Link)[^>]*?className=(['"[][^'"]*?))rounded-(?:full|md|lg|xl|2xl|3xl|\[.*?\])([^'"]*['"]>)/g, (match, prefix, quotes, suffix) => {
        // Only change if it's likely a primary button (has padding)
        if (prefix.includes('px-') || prefix.includes('py-')) {
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
