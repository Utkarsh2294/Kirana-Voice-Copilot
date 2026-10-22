import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Gallery() {
  const { t } = useTranslation();
  return <h1>{t('gallery.title')}</h1>;
}
