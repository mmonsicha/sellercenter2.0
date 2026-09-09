<script lang="ts">
	export let _onClose: () => void;
</script>

<ssk-button variant="outline" themeColor="button" width="full" on:click={_onClose}>
	<ssk-text color="gray.800">ปิด</ssk-text>
</ssk-button>
