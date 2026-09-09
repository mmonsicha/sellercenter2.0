import { writable } from 'svelte/store';

export type Sidebar = {
    expanded: boolean,
    expandedGroups: string[],
}

export const sidebar = writable<Sidebar>({ 
    expanded: false,
    expandedGroups: [],
 });

export const sidebarToggle = () => {
    sidebar.update((s) => {
        return { ...s, expanded: !s.expanded }
    })
}

export const sidebarExpandedGroup = (group: string, expanded: boolean = true) => {
    if (expanded) {
        sidebar.update((s) => {
            return { ...s, expandedGroups: [...s.expandedGroups, group] }
        })
        return
    }

    sidebar.update((s) => {
        return { ...s, expandedGroups: s.expandedGroups.filter((g) => g !== group) }
    })
}