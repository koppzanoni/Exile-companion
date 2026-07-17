import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores:['**/dist/**','**/node_modules/**','frontend/public/data/**']},
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {files:['frontend/src/**/*.{ts,tsx}'],plugins:{'react-hooks':reactHooks},rules:{...reactHooks.configs['flat/recommended'].rules}},
  {files:['**/*.{ts,tsx}'],rules:{'@typescript-eslint/no-explicit-any':'warn','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'no-unused-vars':'off','no-empty':['error',{allowEmptyCatch:true}],'no-constant-binary-expression':'error'}},
  {files:['scripts/**/*.mjs'],languageOptions:{globals:{fetch:'readonly',console:'readonly',process:'readonly'}},rules:{'no-unused-vars':'error'}}
);
