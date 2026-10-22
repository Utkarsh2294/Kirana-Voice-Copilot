import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../auth/query.js';
import CatalogScreen from '../catalog/CatalogScreen.jsx';

export default function Catalog() {
  const [client] = useState(createQueryClient);
  useEffect(() => () => client.clear(), [client]);
  return (
    <QueryClientProvider client={client}>
      <CatalogScreen />
    </QueryClientProvider>
  );
}
