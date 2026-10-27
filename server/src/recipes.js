// Small starter catalog of American-style dishes. Expand with reviewed recipes later.
export const recipes = [
  {
    id: "cheese-omelet",
    name: "American Cheddar Omelet",
    style: "American",
    description: "A simple diner-style omelet with cheddar.",
    ingredients: [
      { name: "eggs", quantity: 2, unit: "count" },
      { name: "cheddar cheese", quantity: 0.25, unit: "cup" },
      { name: "butter", quantity: 1, unit: "tsp" }
    ],
    instructions: ["Beat the eggs.", "Melt butter in a skillet over medium-low heat.", "Add eggs, cook gently, add cheddar, fold, and serve."]
  },
  {
    id: "grilled-cheese",
    name: "Classic American Grilled Cheese",
    style: "American",
    description: "Crisp, buttery bread with melted cheese.",
    ingredients: [
      { name: "bread", quantity: 2, unit: "slices" },
      { name: "cheddar cheese", quantity: 2, unit: "slices" },
      { name: "butter", quantity: 1, unit: "tbsp" }
    ],
    instructions: ["Butter the outside of the bread.", "Add cheese between the slices.", "Cook in a skillet until golden and the cheese melts."]
  },
  {
    id: "tomato-cheddar-salad",
    name: "American Tomato and Cheddar Salad",
    style: "American",
    description: "A quick, fresh side salad.",
    ingredients: [
      { name: "tomatoes", quantity: 2, unit: "count" },
      { name: "lettuce", quantity: 2, unit: "cups" },
      { name: "cheddar cheese", quantity: 0.25, unit: "cup" }
    ],
    instructions: ["Wash and chop the vegetables.", "Add shredded cheddar.", "Season with your preferred dressing if available."]
  },
  {
    id: "cheeseburger",
    name: "Classic American Cheeseburger",
    style: "American",
    description: "A classic burger; requires ingredients beyond the starter sample inventory.",
    ingredients: [
      { name: "ground beef", quantity: 0.5, unit: "lb" },
      { name: "burger buns", quantity: 2, unit: "count" },
      { name: "cheddar cheese", quantity: 2, unit: "slices" },
      { name: "lettuce", quantity: 2, unit: "leaves" },
      { name: "tomatoes", quantity: 1, unit: "count" }
    ],
    instructions: ["Form and cook beef patties thoroughly.", "Melt cheese on the patties.", "Serve on buns with lettuce and tomato."]
  }
];

const norm = value => value.trim().toLowerCase();
export function matchRecipes(fridgeItems) {
  const inventory = new Map();
  for (const item of fridgeItems) {
    const key = norm(item.name);
    if (!inventory.has(key)) inventory.set(key, []);
    inventory.get(key).push(item);
  }

  return recipes.filter(r => r.style === "American").map(recipe => {
    const missing = [];
    const low = [];
    for (const ingredient of recipe.ingredients) {
      const matches = inventory.get(norm(ingredient.name)) || [];
      const available = matches.some(item => item.stockStatus !== "empty" && Number(item.quantity) > 0);
      if (!available) missing.push(ingredient);
      else if (matches.some(item => item.stockStatus === "low")) low.push(ingredient);
    }
    return {
      ...recipe,
      missingIngredients: missing,
      lowStockIngredients: low,
      readyToCook: missing.length === 0,
      status: missing.length === 0 ? "Ready to cook" : "Missing ingredients"
    };
  }).sort((a, b) => Number(b.readyToCook) - Number(a.readyToCook));
}
