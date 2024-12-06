'use strict';

//(function () {
function enterAdd(e, c) {
    if (e.key == 'Enter' && e.target.value) {
        c.itemList.insertBefore(c.chip(e.target.value), e.target);
        e.target.value = ""
        const removeElementButtons = [...c.querySelectorAll('.editable-list-remove-item')];
        c.handleRemoveItemListeners(removeElementButtons);
    }
}
class EditableList extends HTMLElement {
    constructor() {
        // establish prototype chain
        super();
        // attaches shadow tree and returns shadow root reference
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow
        // creating a container for the editable-list component
        const editableListContainer = document.createElement('div');

        // get attribute values from getters
        const title = this.title;
        const addItemText = this.addItemText;
        const listItems = this.items;

        // adding a class to our container for the sake of clarity
        editableListContainer.classList.add('editable-list','relative');


        // creating the inner HTML of the editable list element
        editableListContainer.innerHTML = `
        <div class="bg-gray-50 item-list flex flex-wrap gap-2 justify-center group  hover:bg-sky-50 hover:shadow hover:ring-sky-50 p-2.5 rounded-lg">
          ${listItems.map(item =>
            this.chip(item).outerHTML
        ).join('')}
            <input id="floating_name"  placeholder='' class="peer bg-transparent border-1 group-focus:border-b-1 focus:outline-none add-new-list-item-input" type="text">
            <label for="floating_name" class="pl-2 absolute top-3 left-0 z-10 origin-[0] -translate-y-6 scale-75 transform text-red-700 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75 peer-focus:border-red-700 peer-[.list]:left-0 peer-[.list]:-translate-y-6 peer-[.list]:scale-75">
            ${title}
        </label>
        </div>
      `;

        // binding methods
        this.addListItem = this.addListItem.bind(this);
        this.handleRemoveItemListeners = this.handleRemoveItemListeners.bind(this);
        this.removeListItem = this.removeListItem.bind(this);

        // appending the container to the shadow DOM
        this.appendChild(editableListContainer);
    }
    chip(name) {
        const div = document.createElement('div');
        div.classList.add('p-2','peer','list', 'shadow', 'rounded-lg', 'relative');
        div.innerHTML = `
            <span class="mr-4">${name}
            </span>
            <button class="editable-list-remove-item bg-red-100 hover:bg-red-300 h-4 w-4 icon text-xs cursor-pointer rotate-45 rounded-full" style="position: absolute;top: 0;right: 0;margin: 3px;"><span style="margin: auto;width: 100%;display: block;position: absolute;right: -0.2px;top: -0.2px;">&oplus;</span></button>
        `;
        return div;
    }
    // add items to the list
    addListItem(e) {

        if (this.inputElement.value) {
            this.itemList.appendChild(this.chip(this.inputElement.value));
            this.inputElement.value = '';

            const removeElementButtons = [...this.querySelectorAll('.editable-list-remove-item')];
            this.handleRemoveItemListeners(removeElementButtons);
        }
    }


    // fires after the element has been attached to the DOM
    connectedCallback() {
        const removeElementButtons = [...this.querySelectorAll('.editable-list-remove-item')];
        this.inputElement = this.querySelector(".add-new-list-item-input");
        this.itemList = this.querySelector('.item-list');
        this.handleRemoveItemListeners(removeElementButtons);
        this.inputElement.addEventListener('keydown', (e) => { enterAdd(e, this) }, false);
    }

    // gathering data from element attributes
    get title() {
        return this.getAttribute('title') || '';
    }

    get items() {
        const items = [];

        [...this.attributes].forEach(attr => {
            if (attr.name.includes('list-item')) {
                items.push(attr.value);
            }
        });

        return items;
    }
    get addItemText() {
        return this.getAttribute('add-item-text') || '';
    }

    handleRemoveItemListeners(arrayOfElements) {
        arrayOfElements.forEach(element => {
            element.addEventListener('click', this.removeListItem, false);
        });
    }

    removeListItem(e) {
        e.target.parentNode.parentNode.remove();
    }
}

// let the browser know about the custom element
customElements.define('editable-list', EditableList);
//}
//)();

