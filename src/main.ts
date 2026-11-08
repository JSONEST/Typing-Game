import './styles.css';
import { mountApp } from './app/app.ts';

const root = document.getElementById('app');
if (!root) throw new Error('Falta el elemento #app en index.html');
mountApp(root);
