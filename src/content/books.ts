export type Page = {
  id: string;
  title: string;
  /** A `require('…png')` asset. */
  image: number;
};

export type Book = {
  id: string;
  title: string;
  /** Optional cover art; falls back to the first page's image. */
  cover?: number;
  pages: Page[];
};

/**
 * The bundled library. To add artwork, drop PNGs (black line art on a white
 * or transparent background) into assets/books/<book>/ and list them here.
 * Ids are used as storage keys, so keep them stable once released.
 */
export const books: Book[] = [
  {
    id: 'outdoors',
    title: 'Outdoors',
    pages: [
      { id: 'house', title: 'House', image: require('../../assets/books/outdoors/house.png') },
      { id: 'tree', title: 'Tree', image: require('../../assets/books/outdoors/tree.png') },
      { id: 'car', title: 'Car', image: require('../../assets/books/outdoors/car.png') },
      { id: 'balloons', title: 'Balloons', image: require('../../assets/books/outdoors/balloons.png') },
    ],
  },
  {
    id: 'animals',
    title: 'Animals',
    pages: [
      { id: 'cat', title: 'Cat', image: require('../../assets/books/animals/cat.png') },
      { id: 'fish', title: 'Fish', image: require('../../assets/books/animals/fish.png') },
      { id: 'butterfly', title: 'Butterfly', image: require('../../assets/books/animals/butterfly.png') },
      { id: 'puppy', title: 'Puppy', image: require('../../assets/books/animals/puppy.png') },
    ],
  },
  {
    id: 'space',
    title: 'Space',
    pages: [
      { id: 'rocket', title: 'Rocket', image: require('../../assets/books/space/rocket.png') },
      { id: 'star', title: 'Star', image: require('../../assets/books/space/star.png') },
      { id: 'planet', title: 'Planet', image: require('../../assets/books/space/planet.png') },
      { id: 'astronaut', title: 'Astronaut', image: require('../../assets/books/space/astronaut.png') },
    ],
  },
];

export function getBook(bookId: string): Book | undefined {
  return books.find((b) => b.id === bookId);
}

export function getPage(bookId: string, pageId: string): Page | undefined {
  return getBook(bookId)?.pages.find((p) => p.id === pageId);
}
