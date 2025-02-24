class HeaderComponent extends HTMLElement {
  constructor() {
    super();

    // Create the header element.
    const headerElement = document.createElement('div');
    headerElement.classList.add('w-96');

    // Set the inner HTML of the header element.
    headerElement.innerHTML = `
      <button class="btn" title="Bold" id="bold"><i class="bi bi-type-bold"></i></button>
      <button class="btn" title="Italic" id="italic"><i class="bi bi-type-italic"></i></button>
      <button class="btn" title="Underline" id="underline"><i class="bi bi-type-underline"></i></button>
      <button class="btn" title="Justify Left" id="align-left"><i class="bi bi-justify-left"></i></button>
      <button class="btn" title="Justify" id="justify"><i class="bi bi-justify"></i></button>
      <button class="btn" title="Justify Right" id="align-right"><i class="bi bi-justify-right"></i></button>
    `;

    // Append the header element to the component.
    this.appendChild(headerElement);

    // Attach event listeners to the buttons.
    headerElement.querySelector('#bold')?.addEventListener('click', () => this.formatText('bold'));
    headerElement.querySelector('#italic')?.addEventListener('click', () => this.formatText('italic'));
    headerElement.querySelector('#underline')?.addEventListener('click', () => this.formatText('underline'));
    headerElement.querySelector('#align-left')?.addEventListener('click', () => this.formatText('justifyLeft'));
    headerElement.querySelector('#justify')?.addEventListener('click', () => this.formatText('justifyCenter'));
    headerElement.querySelector('#align-right')?.addEventListener('click', () => this.formatText('justifyRight'));
  }

  // Helper method to wrap selected text with a specified tag and optional styles.
  wrapText(x: { range: Range, tag: string, styles?: { [key: string]: string } }) {
    const wrapper = document.createElement(x.tag);
    if (x.styles) {
      Object.assign(wrapper.style, x.styles);
    }
    wrapper.appendChild(x.range.extractContents());
    x.range.insertNode(wrapper);
    x.range.selectNodeContents(wrapper);
    const selection = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(x.range);
    }
  }

  // Method to apply text formatting.
  formatText(command: string) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const editableDiv = this.parentElement?.querySelector('[contenteditable="true"]');

    if (editableDiv && editableDiv.contains(range.commonAncestorContainer))
      switch (command) {
        case 'bold': {
          // if(range.commonAncestorContainer instanceof)
          this.wrapText({ range: range, tag: 'b' });
          break;
        }
        case 'italic':
          this.wrapText({ range: range, tag: 'i' });
          break;
        case 'underline':
          this.wrapText({ range: range, tag: 'u' });
          break;
        case 'justifyLeft':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'left' } });
          break;
        case 'justifyCenter':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'center' } });
          break;
        case 'justifyRight':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'right' } });
          break;
        default:
          break;
      }
  }
}
function editable() {
  const element = document.createElement('div');
  element.classList.add('w-96', 'p-2', 'border', 'border-slate-600');
  element.contentEditable = 'true';
  return element;
}
class Wysiwyg extends HTMLElement {
  constructor() {
    // establish prototype chain
    super();
    const header = document.createElement('header-wysiwyg');
    this.appendChild(header);
    const editable = document.createElement('div');
    editable.classList.add('w-96', 'p-2', 'border', 'border-slate-600');
    editable.contentEditable = 'true';
    this.appendChild(editable);
    // const editableListContainer: HTMLDivElement = document.createElement('div');
  }
  point = [0, 1, 2, 3, 4, 5];
}
// let the browser know about the custom element
customElements.define('wysiwyg-bs', Wysiwyg);

// Define the new custom element.
customElements.define('header-wysiwyg', HeaderComponent);