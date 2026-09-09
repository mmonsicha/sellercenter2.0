import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import removeAttribute from 'svelte-preprocess-remove-attribute';

export default {  
  onwarn: (warning, handler) => {
    if (warning.code.startsWith('a11y-')) {
      return;
    }
    handler(warning);
  },
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: [
    removeAttribute({
      filter: (name => {
        if (process.env.NODE_ENV === 'production') {
          return name !== 'data-testid' && name !== 'testId'
        } else {
          return true
        }
        
      })
    }),
    vitePreprocess(),
  ],
}
