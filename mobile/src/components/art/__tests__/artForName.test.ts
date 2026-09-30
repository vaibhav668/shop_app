import { artForName } from '@/components/art/Produce';

describe('artForName', () => {
  it.each([
    ['Toned Milk', 'milk'],
    ['Curd', 'milk'],
    ['Fresh Paneer', 'paneer'],
    ['Farm Eggs', 'eggs'],
    ['Salted Butter', 'bar'],
    ['Buttermilk', 'milk'],
    ['Tomato', 'tomato'],
    ['Potato', 'potato'],
    ['Onion', 'onion'],
    ['Green Chilli', 'chilli'],
    ['Banana Robusta', 'banana'],
    ['Coriander Leaves', 'greens'],
    ['Whole Wheat Bread', 'bread'],
    ['Pav', 'bread'],
    ['Chakki Atta', 'sack'],
    ['Toor Dal', 'sack'],
    ['Sunflower Oil', 'bottle'],
    ['Mango Drink', 'bottle'],
    ['Salted Potato Chips', 'packet'],
    ['Aloo Bhujia', 'packet'],
    ['Tea Leaves', 'packet'],
    ['Bathing Soap', 'bar'],
    ['Dairy & Eggs', 'milk'],
    ['Bakery', 'bread'],
    ['Staples', 'sack'],
    ['Beverages', 'bottle'],
  ])('%s → %s', (name, kind) => {
    expect(artForName(name)).toBe(kind);
  });

  it('returns null when nothing matches, so the plain basket shows', () => {
    expect(artForName('Toothpaste')).toBeNull();
    expect(artForName('')).toBeNull();
  });
});
