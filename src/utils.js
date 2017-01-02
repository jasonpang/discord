export function getConsoleStyle(style) {
    if (style == 'code') {
        return `
    padding: 0 5px 2px;
    border: 1px solid #ddd;
    -webkit-border-radius: 3px;
    -moz-border-radius: 3px;
    border-radius: 3px;
    background-clip: padding-box;
    font-family: Monaco,"DejaVu Sans Mono","Courier New",monospace;
    color: #666;
    `
    } else if (style == 'bold') {
        return `
      font-weight: 600;
    color: rgb(51, 51, 51);
    `;
    } else if (style == 'alert') {
        return `
      font-weight: 600;
    color: red;
    `;
    } else if (style == 'event') {
        return `
    color: green;
    `;
    } else if (style == 'postmessage') {
        return `
    color: orange;
    `;
    }
}