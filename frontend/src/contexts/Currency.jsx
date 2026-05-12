import { createContext, useContext } from 'react';

export const CurrencyContext = createContext({ baseCurrency: 'EUR', rates: null });
export const useCurrency = () => useContext(CurrencyContext);
