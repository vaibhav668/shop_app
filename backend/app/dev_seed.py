"""Sample catalog for LOCAL development only (`python -m app.cli seed-dev`).

The apps never contain product data; this only fills an empty local database so there is
something to browse. Real products are added by the shopkeeper in the admin dashboard.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Product
from app.services.inventory import InventoryService
from app.utils.slugs import slugify

# (category, [(name, unit, price ₹, mrp ₹, stock, keywords)])
SAMPLE: list[tuple[str, list[tuple[str, str, float, float, int, str]]]] = [
    (
        "Dairy & Eggs",
        [
            ("Toned Milk", "500 ml", 28, 28, 40, "doodh"),
            ("Full Cream Milk", "1 L", 68, 68, 25, "doodh"),
            ("Fresh Paneer", "200 g", 90, 95, 12, "cottage cheese"),
            ("Farm Eggs", "6 pcs", 54, 60, 30, "anda"),
            ("Salted Butter", "100 g", 56, 58, 4, "makhan"),
            ("Curd", "400 g", 45, 45, 0, "dahi yogurt"),
        ],
    ),
    (
        "Fruits & Vegetables",
        [
            ("Onion", "1 kg", 38, 45, 60, "pyaz kanda"),
            ("Tomato", "500 g", 22, 25, 45, "tamatar"),
            ("Potato", "1 kg", 32, 35, 80, "aloo"),
            ("Banana Robusta", "6 pcs", 42, 48, 20, "kela"),
            ("Coriander Leaves", "100 g", 12, 15, 3, "dhaniya"),
            ("Green Chilli", "100 g", 10, 12, 18, "hari mirch"),
        ],
    ),
    (
        "Bakery",
        [
            ("Whole Wheat Bread", "400 g", 45, 50, 15, "atta bread"),
            ("Pav", "6 pcs", 30, 30, 10, "bun"),
            ("Rusk", "300 g", 55, 60, 22, "toast"),
        ],
    ),
    (
        "Staples",
        [
            ("Chakki Atta", "5 kg", 245, 275, 20, "wheat flour gehun"),
            ("Basmati Rice", "1 kg", 145, 160, 18, "chawal"),
            ("Toor Dal", "1 kg", 165, 180, 14, "arhar"),
            ("Sunflower Oil", "1 L", 155, 170, 9, "tel"),
            ("Iodised Salt", "1 kg", 26, 28, 35, "namak"),
            ("Sugar", "1 kg", 48, 50, 30, "cheeni"),
        ],
    ),
    (
        "Snacks",
        [
            ("Aloo Bhujia", "200 g", 55, 60, 25, "namkeen"),
            ("Salted Potato Chips", "90 g", 30, 30, 40, "wafers"),
            ("Marie Biscuits", "250 g", 35, 40, 28, "biscuit"),
        ],
    ),
    (
        "Beverages",
        [
            ("Tea Leaves", "250 g", 140, 155, 16, "chai patti"),
            ("Instant Coffee", "50 g", 165, 180, 6, "coffee"),
            ("Mango Drink", "600 ml", 40, 40, 24, "juice"),
        ],
    ),
    (
        "Personal Care",
        [
            ("Bathing Soap", "4 x 100 g", 140, 160, 20, "sabun"),
            ("Toothpaste", "150 g", 95, 105, 15, "paste"),
        ],
    ),
    (
        "Household",
        [
            ("Dishwash Bar", "3 x 200 g", 55, 60, 22, "bartan"),
            ("Detergent Powder", "1 kg", 110, 125, 12, "surf"),
        ],
    ),
]


def seed_dev_catalog(db: Session) -> str:
    if db.scalar(select(func.count()).select_from(Category)):
        return "Catalog already has data; nothing seeded."
    inventory = InventoryService(db)
    products = 0
    for position, (category_name, items) in enumerate(SAMPLE, start=1):
        category = Category(name=category_name, slug=slugify(category_name), sort_order=position)
        db.add(category)
        db.flush()
        for order, (name, unit, price, mrp, stock, keywords) in enumerate(items, start=1):
            product = Product(
                category_id=category.id,
                name=name,
                slug=slugify(f"{name} {unit}"),
                unit_label=unit,
                price_paise=round(price * 100),
                mrp_paise=round(mrp * 100),
                stock_quantity=stock,
                search_keywords=keywords,
                sort_order=order,
                is_featured=order == 1,
            )
            db.add(product)
            db.flush()
            inventory.record_initial(product, None)
            products += 1
    db.commit()
    return f"Seeded {len(SAMPLE)} categories and {products} products (no photos)."
