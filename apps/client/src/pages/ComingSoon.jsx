import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState, ListenButton } from '../components/primitives.jsx';
import { useUi } from '../components/overlays.jsx';

export default function ComingSoon({ name, phase = 3 }) {
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/demo/') ? '/demo' : '';
  const { t } = useTranslation();
  const { read } = useUi();
  const description =
    name === 'notFound'
      ? t('prototype.description')
      : t('prototype.comingBody', { feature: t(`nav.${name}`), phase });
  return (
    <EmptyState
      icon={Construction}
      title={t(`nav.${name}`)}
      description={description}
      action={
        <div className="row">
          <Link className="button button--primary" to={`${prefix}/bill`}>
            {t('catalog.openBill')}
          </Link>
          <ListenButton onClick={() => read(description)} />
        </div>
      }
    />
  );
}
