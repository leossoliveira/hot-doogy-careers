import {defineConfig} from 'vite';
export default defineConfig({server:{port:5174,strictPort:true,host:'127.0.0.1'},build:{target:'es2022',outDir:'dist',assetsInlineLimit:0}});
