import { getCleanStrings, getRecipe } from "./helpers";

const epicurious = ($: CheerioStatic, url: string) => {
  const title = getCleanStrings($, `h1`);
  const ingredients = getCleanStrings($, `.ingredient`);
  const instructions = getCleanStrings($, `.preparation-step`);

  return {
    sourceSite: `epicurious.com`,
    sourceUrl: url,
    title: title[0],
    recipe: getRecipe(url, title, ingredients, instructions),
  };
};

export default epicurious;