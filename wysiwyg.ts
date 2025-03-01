const button: (title: any, innerHTML: any) => {
  value: number;
  element: HTMLButtonElement;
} = (title, innerHTML) => {
  const button = document.createElement('button');
  button.classList.add('btn');
  button.title = title;
  button.innerHTML = innerHTML;
  return {
    value: 0,
    element: button
  }
};
class Wysiwyg extends HTMLElement {
  editable() {
    const element = document.createElement('div');
    element.classList.add('w-96', 'p-2', 'border', 'border-slate-600');
    element.contentEditable = 'true';
    return element;
  }
  headerElement: HTMLElement;
  editableElement: HTMLElement;
  bold = button('Bold Toggle', `<i class="bi bi-type-bold"></i>`);
  italic = button('Italic Toggle', `<i class="bi bi-type-italic"></i>`);
  underline = button('Underline Toggle', `<i class="bi bi-type-underline"></i>`);
  rightAlign = button('Right Aling Toggle', `<i class="bi bi-justify-right"></i>`);
  leftAlign = button('Left Align Toggle', `<i class="bi bi-justify-left"></i>`);
  justifyAlign = button('Justify Toggle', `<i class="bi bi-justify"></i>`);
  public handleSelectionChange(selectedText: string) {
    // Your logic to handle the selection change
    console.log("Selected Text: ", selectedText);
    //For example, you could change the background color of the selected text.
    //Or perhaps display a popup with options.
  }
  handleMouseOrKeySelection() {
    const selection = window.getSelection();
    if (selection) {
      console.log('Selection changed (mouseup/keyup):', selection.toString());
      this.handleSelectionChange(selection.toString());
    }

  }

  constructor() {
    // establish prototype chain
    super();

    // Create the header element.
    this.headerElement = document.createElement('div');
    this.headerElement.classList.add('w-96');
    this.headerElement.appendChild(this.bold.element);
    this.headerElement.appendChild(this.italic.element)
    this.headerElement.appendChild(this.underline.element)
    this.headerElement.appendChild(this.justifyAlign.element)
    this.headerElement.appendChild(this.rightAlign.element)
    this.headerElement.appendChild(this.leftAlign.element);
    // Set the inner HTML of the header element.
    // Append the header element to the component.

    // Attach event listeners to the buttons.
    this.bold.element?.addEventListener('click', (e: MouseEvent) => this.formatText('b', this.bold, e));
    this.italic.element?.addEventListener('click', (e: Event) => this.formatText('i', this.italic, e));
    this.underline.element?.addEventListener('click', (e: Event) => this.formatText('u', this.underline, e));
    this.leftAlign.element?.addEventListener('click', (e: Event) => this.formatText('justifyLeft', this.leftAlign, e));
    this.justifyAlign.element?.addEventListener('click', (e: Event) => this.formatText('justifyCenter', this.justifyAlign, e));
    this.rightAlign.element?.addEventListener('click', (e: Event) => this.formatText('justifyRight', this.rightAlign, e));
    this.appendChild(this.headerElement);
    this.editableElement = document.createElement('div');
    this.editableElement.classList.add('parent', 'p-2', 'border');
    this.editableElement.contentEditable = 'true';
    this.appendChild(this.editableElement);
    this.editableElement.addEventListener('input', () => {
      const selection = document.getSelection();
      if(selection && selection.rangeCount > 0){
        const range = selection.getRangeAt(0);
        const parent = (this.getAllParents(selection.anchorNode as HTMLElement));
        if (parent.length == 1) {
          const wrapper = document.createElement('DIV');
          // console.log(x.range.extractContents());
          wrapper.append(range.extractContents());
          this.editableElement.innerHTML = '';
          range.insertNode(wrapper);
          range.selectNodeContents(wrapper);
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
          this.editableElement.appendChild(wrapper);
        }
      }
      // console.clear()
    })
    this.editableElement.addEventListener('keyup', () => {
      this.pre.innerHTML = this.editableElement.innerHTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      this.getCaretPosition()
    })
    this.editableElement.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (this.editableElement.contains(range.commonAncestorContainer)) {
          // Selection changed within the editable div
          console.log('Selection changed:', selection.toString());
          // Perform other actions.
          this.handleSelectionChange(selection.toString());
        }
      }
    });

    this.editableElement.addEventListener('mouseup', () => {
      this.handleMouseOrKeySelection()
    });
    this.editableElement.addEventListener('keyup', () => {
      this.handleMouseOrKeySelection()
    });
    this.editableElement.addEventListener('click', () => {
      this.getCaretPosition();
    });
    this.pre = document.createElement('pre');
    this.pre.classList.add('text-break');
    this.appendChild(this.pre);
  }
  public pre;
  replaceSelectedText(Element: HTMLElement) {
    const selection = window.getSelection();

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Delete the selected content
      range.deleteContents();

      // Create a text node with the new text
      const textNode = Element;

      // Insert the new text node at the range's start
      range.insertNode(textNode);

      // Collapse the selection to the end of the inserted text
      range.collapse(false); // false collapses to the end

      // Update the selection with the modified range
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }


  getAllParents(element: HTMLElement) {
    let parents: HTMLElement[] = [];
    while (element.parentNode && element.parentNode.nodeName !== "WYSIWYG-BS") {
      parents.push(element.parentNode as HTMLElement);
      element = element.parentNode as HTMLElement;
    }
    return parents;
  }
  removeClassFromNodeAndChildren(node: HTMLElement, className) {
    if (node && node.classList) {
      node.classList.remove(className);

      // Recursively remove the class from child nodes
      const children = node.querySelectorAll('*'); // Select all descendants
      children.forEach(child => {
        if (child.classList) {
          child.classList.remove(className);
        }
      });
    }
  }

  getCaretPosition() {
    var selection = document.getSelection();
    if (selection?.anchorNode?.parentNode) {
      const parent = (this.getAllParents(selection.anchorNode as HTMLElement));
      this.removeClassFromNodeAndChildren(this.editableElement, 'bg-primary-subtle');
      document.getSelection();
      if (parent.length > 1) {
        parent[0].classList.add('bg-primary-subtle')
      }
      console.log(parent.map(i => i.nodeName));
      if (parent.map(i => i.nodeName).includes('B')) {
        this.bold.element?.classList.add('btn-primary');
      } else {
        this.bold.element?.classList.remove('btn-primary');
      }
      if (parent.map(i => i.nodeName).includes('I')) {
        this.italic.element?.classList.add('btn-primary');
      } else {
        this.italic.element?.classList.remove('btn-primary');
      }
      if (parent.map(i => i.nodeName).includes('U')) {
        this.underline.element?.classList.add('btn-primary');
      } else {
        this.underline.element?.classList.remove('btn-primary');
      }
    }
  }
  unwrapHTML(wrapper: HTMLElement) {
    const parent = wrapper.parentNode;
    if (parent) {
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      parent.removeChild(wrapper);
    }
  }
  // Helper method to wrap selected text with a specified tag and optional styles.
  wrapText(x: { range?: Range, tag: string, styles?: { [key: string]: string } }) {
    if (x.range) {
      const wrapper = document.createElement(x.tag);
      if (x.styles) {
        Object.assign(wrapper.style, x.styles);
      }
      // console.log(x.range.extractContents());
      wrapper.appendChild(x.range.extractContents());
      x.range.insertNode(wrapper);
      x.range.selectNodeContents(wrapper);
      const selection = document.getSelection();
      if (selection) {
        const parent = (this.getAllParents(selection.anchorNode as HTMLElement));
      }
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(x.range);
      }
    } else {

    }
  }

  // Method to apply text formatting.
  formatText(command: string, button: {
    value: number;
    element: HTMLButtonElement;
  }, event: Event) {
    button.element.classList.add('btn-primary');
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // No selection, create a new tag (e.g., a <div> element)
      let newDiv = document.createElement('div');
      newDiv.innerHTML = 'New content here!';
      this.wrapText({ tag: 'b' })
      return;
      // } else {
      //   // No selection, create a new tag (e.g., a <div> element)
      //   let newDiv = document.createElement('div');
      //   newDiv.innerHTML = 'New content here!';
    }
    const range = selection.getRangeAt(0);
    if (this.editableElement && this.editableElement.contains(range.commonAncestorContainer))
      switch (command) {
        case 'b': {
          // if(range.commonAncestorContainer instanceof)
          this.wrapText({ range: range, tag: 'b' });
          this.bold.element.classList.remove('btn-primary')
          break;
        }
        case 'i':
          this.wrapText({ range: range, tag: 'i' });
          this.italic.element.classList.remove('btn-primary');
          break;
        case 'u':
          this.wrapText({ range: range, tag: 'u' });
          this.underline.element.classList.remove('btn-primary');
          break;
        case 'justifyLeft':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'left' } });
          this.leftAlign.element.classList.remove('btn-primary');
          break;
        case 'justifyCenter':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'center' } });
          this.justifyAlign.element.classList.remove('btn-primary');
          break;
        case 'justifyRight':
          this.wrapText({ range: range, tag: 'div', styles: { textAlign: 'right' } });
          this.rightAlign.element.classList.remove('btn-primary');
          break;
        default:
          break;
      }
    this.getCaretPosition();
  }
  point = [0, 1, 2, 3, 4, 5];
}
// let the browser know about the custom element
customElements.define('wysiwyg-bs', Wysiwyg);

// Define the new custom element.
// customElements.define('header-wysiwyg', HeaderComponent);