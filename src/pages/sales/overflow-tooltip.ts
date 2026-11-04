interface ManagedTitle {
	originalTitle: string | null;
	tooltipTitle: string;
}

function isOverflowing(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element);
	const hasTextEllipsis = style.textOverflow === 'ellipsis';
	const lineClamp = style.getPropertyValue('-webkit-line-clamp');
	const hasLineClamp = lineClamp !== '' && lineClamp !== 'none' && lineClamp !== '0';

	if (hasTextEllipsis && element.scrollWidth > element.clientWidth + 1) return true;
	return hasLineClamp && element.scrollHeight > element.clientHeight + 1;
}

function tooltipText(element: HTMLElement): string {
	return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

export function overflowTooltip(node: HTMLElement) {
	const managedTitles = new Map<HTMLElement, ManagedTitle>();

	function updateTitle(element: HTMLElement) {
		const managedTitle = managedTitles.get(element);
		const currentTitle = element.getAttribute('title');

		if (!managedTitle && currentTitle !== null) return;
		if (
			managedTitle &&
			currentTitle !== managedTitle.tooltipTitle
		) {
			managedTitles.delete(element);
			return;
		}

		const text = tooltipText(element);
		if (text && isOverflowing(element)) {
			if (managedTitle) {
				managedTitle.tooltipTitle = text;
			} else {
				managedTitles.set(element, { originalTitle: currentTitle, tooltipTitle: text });
			}
			element.setAttribute('title', text);
			return;
		}

		if (managedTitle) {
			if (managedTitle.originalTitle === null) element.removeAttribute('title');
			else element.setAttribute('title', managedTitle.originalTitle);
			managedTitles.delete(element);
		}
	}

	function updatePath(event: Event) {
		for (const target of event.composedPath()) {
			if (!(target instanceof HTMLElement)) continue;
			if (target === node) break;
			if (node.contains(target)) updateTitle(target);
		}
	}

	node.addEventListener('pointerover', updatePath);
	node.addEventListener('focusin', updatePath);

	return {
		destroy() {
			node.removeEventListener('pointerover', updatePath);
			node.removeEventListener('focusin', updatePath);
			for (const [element, managedTitle] of managedTitles) {
				if (element.getAttribute('title') !== managedTitle.tooltipTitle) continue;
				if (managedTitle.originalTitle === null) element.removeAttribute('title');
				else element.setAttribute('title', managedTitle.originalTitle);
			}
			managedTitles.clear();
		}
	};
}
