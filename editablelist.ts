'use strict';

function enterAdd(e: KeyboardEvent, c: EditableList): void {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.value) {
        c.itemList.insertBefore(c.chip(e.target.value), e.target);
        e.target.value = "";
        c.handleRemoveItemListeners(c.querySelectorAll('.editable-list-remove-item'));
    }
}

class EditableList extends HTMLElement {
    private inputElement!: HTMLInputElement;
    public itemList!: HTMLElement;

    constructor() {
        super();
        const editableListContainer: HTMLDivElement = document.createElement('div');

        const title: string = this.title;
        const addItemText: string = this.addItemText;
        const listItems: string[] = this.items;

        editableListContainer.classList.add('editable-list', 'relative');

        editableListContainer.innerHTML = `
        <div class="bg-gray-50 item-list flex flex-wrap gap-2 justify-center group hover:bg-sky-50 hover:shadow hover:ring-sky-50 p-2.5 rounded-lg">
          ${listItems.map(item => this.chip(item).outerHTML).join('')}
            <input id="floating_name" placeholder='' class="peer bg-transparent border-1 group-focus:border-b-1 focus:outline-none add-new-list-item-input" type="text">
            <label for="floating_name" class="pl-2 absolute top-3 left-0 z-10 origin-[0] -translate-y-6 scale-75 transform text-red-700 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:border-red-700 peer-[.list]:left-0 peer-[.list]:-translate-y-6 peer-[.list]:scale-75">
            ${title}
        </label>
        </div>
      `;

        this.addListItem = this.addListItem.bind(this);
        this.handleRemoveItemListeners = this.handleRemoveItemListeners.bind(this);
        this.removeListItem = this.removeListItem.bind(this);
        this.appendChild(editableListContainer);
    }

    chip(name: string): HTMLDivElement {
        const div: HTMLDivElement = document.createElement('div');
        div.classList.add('p-2', 'peer', 'list', 'shadow', 'rounded-lg', 'relative');

        div.innerHTML = `
            <span class="mr-7">${name}</span>
            <button class="editable-list-remove-item bg-red-100 hover:bg-red-300 h-7 w-7 text-xl icon cursor-pointer rotate-45 rounded-full text-slate-700 hover:text-white" style="position: absolute;top: 0;right: 0;margin: 3px;"><span style="margin: auto;width: 100%;display: block;position: absolute;right: -0.2px;top: -0.2px;" class="">&oplus;</span></button>
        `;

        return div;
    }

    addListItem(e: Event): void {
        if (this.inputElement.value) {
            this.itemList.appendChild(this.chip(this.inputElement.value));
            this.inputElement.value = '';
            // const removeElementButtons: HTMLElement[] = [...this.querySelectorAll('.editable-list-remove-item')];
            this.handleRemoveItemListeners(this.querySelectorAll('.editable-list-remove-item'));
        }
    }

    connectedCallback(): void {
        // const removeElementButtons: HTMLElement[] = [...this.querySelectorAll('.editable-list-remove-item')];

        this.inputElement = this.querySelector(".add-new-list-item-input") as HTMLInputElement;
        this.itemList = this.querySelector('.item-list') as HTMLElement;

        this.handleRemoveItemListeners(this.querySelectorAll('.editable-list-remove-item'));

        this.inputElement.addEventListener('keydown', (e) => { enterAdd(e, this); }, false);
    }

    get title(): string {
        return this.getAttribute('title') || '';
    }

    get items(): string[] {
        const items: string[] = [];

        [...this.attributes].forEach(attr => {
            if (attr.name.includes('list-item')) {
                items.push(attr.value);
            }
        });
        return items;
    }

    get addItemText(): string {
        return this.getAttribute('add-item-text') || '';
    }

    handleRemoveItemListeners(arrayOfElements): void {
        arrayOfElements.forEach(element => {
            element.addEventListener('click', this.removeListItem, false);
        });
    }
    removeListItem(e: MouseEvent): void {
        const target = e.target as HTMLElement;
        if (target && target.parentNode && target.parentNode.parentNode) {
            const grandParent = target.parentNode.parentNode as HTMLElement;
            grandParent.remove();
        }
    }    
}

customElements.define('editable-list', EditableList);
