import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Order } from '@/types'

interface OrderState {
  orders: Order[]
  customerPhone: string | null
  isLoading: boolean
  _hydrated: boolean
  addOrder: (order: Order) => void
  clearOrders: () => void
  setCustomerPhone: (phone: string) => void
  fetchOrdersFromServer: (phone: string) => Promise<void>
  refreshOrders: () => Promise<void>
  setHydrated: (state: boolean) => void
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      customerPhone: null,
      isLoading: false,
      _hydrated: false,

      setHydrated: (state: boolean) => set({ _hydrated: state }),

      addOrder: (order: Order) => {
        set((state) => ({
          orders: [order, ...state.orders]
        }))
      },

      clearOrders: () => {
        set({ orders: [], customerPhone: null })
      },

      setCustomerPhone: (phone: string) => {
        console.log('[ORDER STORE] Setting customer phone:', phone)
        set({ customerPhone: phone })
      },

      fetchOrdersFromServer: async (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '')
        if (cleanPhone.length < 10) {
          console.log('[ORDER STORE] Phone number too short:', cleanPhone)
          return
        }

        set({ isLoading: true })
        
        try {
          console.log('[ORDER STORE] Fetching orders from server for phone:', cleanPhone)
          
          // Add timestamp to prevent caching
          const timestamp = Date.now()
          const response = await fetch(`/api/orders?phone=${encodeURIComponent(cleanPhone)}&_t=${timestamp}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
          const result = await response.json()
          
          console.log('[ORDER STORE] API response success:', result.success, 'count:', result.count)
          
          if (result.success && result.data) {
            // API already returns properly formatted data
            // Just transform to match Order type with correct field names
            const orders: Order[] = result.data.map((o: any) => ({
              id: o.id,
              customer: o.customerName, // Map to 'customer' for Orders component
              phone: o.phone,
              address: o.address,
              note: o.note,
              date: o.date,
              time: o.time,
              paymentMethod: o.paymentMethod,
              status: o.status,
              courierStatus: o.courierStatus,
              consignmentId: o.consignmentId,
              trackingCode: o.trackingCode,
              courierDeliveredAt: o.courierDeliveredAt,
              subtotal: parseFloat(o.subtotal) || 0,
              delivery: parseFloat(o.delivery) || 0,
              discount: parseFloat(o.discount) || 0,
              couponCodes: typeof o.couponCodes === 'string' ? JSON.parse(o.couponCodes) : (o.couponCodes || []),
              couponAmount: parseFloat(o.couponAmount) || 0,
              total: parseFloat(o.total) || 0,
              canceledBy: o.canceledBy,
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              items: (o.items || []).map((item: any) => ({
                name: item.name,
                variant: item.variant,
                qty: item.qty,
                basePrice: parseFloat(item.basePrice) || 0,
                offerText: item.offerText,
                offerDiscount: parseFloat(item.offerDiscount) || 0,
                couponCode: item.couponCode,
                couponDiscount: parseFloat(item.couponDiscount) || 0,
                productId: item.productId,
              })),
            }))
            
            set({ 
              orders, 
              customerPhone: phone,
            })
            console.log('[ORDER STORE] ✅ Fetched', orders.length, 'orders from server')
            // Log order statuses for debugging
            orders.forEach(o => {
              console.log('[ORDER STORE] Order:', o.id, 'status:', o.status, 'courierStatus:', o.courierStatus)
            })
          } else {
            console.log('[ORDER STORE] No orders found or API error:', result)
            set({ orders: [] })
          }
        } catch (error) {
          console.error('[ORDER STORE] Error fetching orders:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      refreshOrders: async () => {
        const { customerPhone } = get()
        
        if (!customerPhone) {
          console.log('[ORDER STORE] No customer phone set, cannot refresh')
          return
        }
        
        console.log('[ORDER STORE] Refreshing orders for phone:', customerPhone)
        await get().fetchOrdersFromServer(customerPhone)
      },
    }),
    {
      name: 'ecomart-orders',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        customerPhone: state.customerPhone 
        // Don't persist orders - always fetch fresh from server
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[ORDER STORE] Rehydrated from localStorage, customerPhone:', state?.customerPhone)
        state?.setHydrated(true)
      },
    }
  )
)
