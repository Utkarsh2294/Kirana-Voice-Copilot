import React from 'react';
import i18n from '../i18n.js';

export class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    console.error('UI_RENDER_FAILED');
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal">
          <h1>{i18n.t('error.title')}</h1>
          <p>{i18n.t('error.body')}</p>
          <button onClick={() => window.location.reload()}>{i18n.t('common.reload')}</button>
        </main>
      );
    return this.props.children;
  }
}
