import React from 'react';
import ReactDOM from 'react-dom/client';
import Overlay from './Overlay';

const root = document.getElementById('root');
if (!root) throw new Error('overlay root not found');

ReactDOM.createRoot(root).render(<Overlay />);
