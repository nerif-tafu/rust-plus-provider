// Renders the API documentation from window.API_DOC_SECTIONS (api-docs-data.js).
// Code samples are assigned via textContent so their JSON is never parsed as
// markup, matching the safe-DOM approach used elsewhere in this project.

function buildEndpointCard(item) {
    const card = createEl('div', { className: 'api-doc' });

    card.append(createEl('h6', { text: item.title }));

    if (item.request) {
        card.append(createEl('pre', { className: 'code', text: item.request }));
    }

    if (item.description) {
        card.append(createEl('p', { text: item.description }));
    }

    if (item.response) {
        card.append(createEl('strong', { text: item.responseLabel || 'Response' }));
        card.append(createEl('pre', { className: 'code', text: item.response }));
    }

    return card;
}

function buildSection(section) {
    const head = createEl('div', { className: 'section-head' });
    head.append(
        createEl('div', {
            children: [
                createEl('h3', { className: 'section-title', text: section.title }),
                createEl('p', { className: 'section-description', text: section.description })
            ]
        })
    );

    // Two-column grid of endpoint cards, as before, but built from data
    const left = createEl('div', { className: 'col-md-6' });
    const right = createEl('div', { className: 'col-md-6' });
    section.items.forEach((item, i) => {
        (i % 2 === 0 ? left : right).append(buildEndpointCard(item));
    });

    const row = createEl('div', { className: 'row', children: [left, right] });
    return createEl('section', { className: 'section', children: [head, row] });
}

function renderApiDocs() {
    const mount = document.getElementById('apiDocsContent');
    if (!mount || !window.API_DOC_SECTIONS) return;
    mount.replaceChildren(...window.API_DOC_SECTIONS.map(buildSection));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApiDocs);
} else {
    renderApiDocs();
}
