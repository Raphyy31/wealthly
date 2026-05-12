import { createContext, useContext } from 'react';

export const HideAmountsContext = createContext(false);

export const useHideAmounts = () => useContext(HideAmountsContext);
