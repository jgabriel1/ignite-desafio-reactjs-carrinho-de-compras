import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const LOCAL_STORAGE_CART_KEY = '@RocketShoes:cart';

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem(LOCAL_STORAGE_CART_KEY);

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const checkStockAvailability = async (
    productId: number,
    requiredQuantity: number,
  ) => {
    const { data: checkStockResponseData } = await api.get<Stock>(
      `stock/${productId}`
    );

    const { amount: stockQuantity } = checkStockResponseData;

    return stockQuantity >= requiredQuantity;
  };

  const fetchProductData = async (productId: number) => {
    const { data: productData } = await api.get<Omit<Product, 'amount'>>(
      `products/${productId}`
    );

    return productData;
  };

  const saveToLocalStorage = (cartToSave: Product[]) => {
    const stringifiedCart = JSON.stringify(cartToSave);

    localStorage.setItem(LOCAL_STORAGE_CART_KEY, stringifiedCart);
  };

  const addProduct = async (productId: number) => {
    try {
      let updatedCart: Product[];

      const productAlreadyInCart = cart.find(product => product.id === productId);

      if (!productAlreadyInCart) {
        const isAvailableInStock = await checkStockAvailability(productId, 1);

        if (!isAvailableInStock) {
          toast.error('Quantidade solicitada fora de estoque');

          return;
        }

        const productData = await fetchProductData(productId);

        updatedCart = [...cart, { ...productData, amount: 1 }];
      } else {
        const { amount: currentQuantity } = productAlreadyInCart;

        const isAvailableInStock = await checkStockAvailability(
          productId,
          currentQuantity + 1,
        );

        if (!isAvailableInStock) {
          toast.error('Quantidade solicitada fora de estoque');

          return;
        }

        updatedCart = cart.map(product => {
          if (product.id === productId)
            return {
              ...product,
              amount: product.amount + 1,
            };

          return product;
        });
      }

      saveToLocalStorage(updatedCart);
      setCart(updatedCart);
    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const isProductInCart = !!cart.find(product => product.id === productId);

      if (!isProductInCart) throw new Error();

      const updatedCart = cart.filter(product => product.id !== productId);

      saveToLocalStorage(updatedCart);
      setCart(updatedCart);
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount < 1) return;

      const isProductInCart = cart.find(product => product.id === productId);

      if (!isProductInCart) throw new Error();

      const isAvailableInStock = await checkStockAvailability(
        productId,
        amount,
      );

      if (!isAvailableInStock) {
        toast.error('Quantidade solicitada fora de estoque');

        return;
      }

      setCart(
        current => {
          const updatedCart = current.map(product => {
            if (product.id === productId)
              return {
                ...product,
                amount,
              };

            return product;
          });

          saveToLocalStorage(updatedCart);

          return updatedCart;
        }
      );
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
