import { Item, Collection, Tag } from './types';
import { v4 as uuidv4 } from 'uuid';

export const MOCK_TAGS: Tag[] = [
  { id: 't1', name: 'Design', color: 'bg-orange-100 text-orange-700' },
  { id: 't2', name: 'Development', color: 'bg-blue-100 text-blue-700' },
  { id: 't3', name: 'Productivity', color: 'bg-green-100 text-green-700' },
  { id: 't4', name: 'AI', color: 'bg-purple-100 text-purple-700' },
  { id: 't5', name: 'Business', color: 'bg-gray-100 text-gray-700' },
];

export const MOCK_COLLECTIONS: Collection[] = [
  { id: 'c1', name: 'Must Read', count: 4 },
  { id: 'c2', name: 'Research', count: 12 },
  { id: 'c3', name: 'Inspiration', count: 8 },
  { id: 'c4', name: 'Tutorials', count: 5 },
];

export const MOCK_ITEMS: Item[] = [
  {
    id: '1',
    title: 'The Future of Interface Design',
    url: 'https://uxdesign.cc/future-interface',
    domain: 'uxdesign.cc',
    excerpt: 'Exploring how AI and spatial computing will reshape the way we interact with digital products in the next decade.',
    imageUrl: 'https://images.unsplash.com/photo-1747727568150-444573cd705a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwYXJjaGl0ZWN0dXJlJTIwYWJzdHJhY3R8ZW58MXx8fHwxNzY4OTkzNzIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['t1', 't4'],
    collectionId: 'c1',
    isFavorite: true,
    isArchived: false,
    isRead: false,
    createdAt: newHZ(new Date(), -2),
    type: 'article',
  },
  {
    id: '2',
    title: 'Understanding React Server Components',
    url: 'https://react.dev/blog/server-components',
    domain: 'react.dev',
    excerpt: 'A deep dive into the architecture of React Server Components and how they improve performance and user experience.',
    imageUrl: 'https://images.unsplash.com/photo-1683813479742-4730f91fa3ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwd29ya3NwYWNlJTIwY29kaW5nfGVufDF8fHx8MTc2ODk4MDUzOXww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['t2'],
    collectionId: 'c4',
    isFavorite: false,
    isArchived: false,
    isRead: false,
    createdAt: newHZ(new Date(), -5),
    type: 'article',
  },
  {
    id: '3',
    title: 'Deep Work: Rules for Focused Success',
    url: 'https://calnewport.com/deep-work',
    domain: 'calnewport.com',
    excerpt: 'Notes on cultivating the ability to focus without distraction on a cognitively demanding task.',
    imageUrl: 'https://images.unsplash.com/photo-1603276730862-cbf79a742aae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuYXR1cmUlMjBjYWxtJTIwbGFuZHNjYXBlfGVufDF8fHx8MTc2ODk5MzczM3ww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['t3', 't5'],
    collectionId: 'c1',
    isFavorite: true,
    isArchived: false,
    isRead: true,
    createdAt: newHZ(new Date(), -10),
    readAt: newHZ(new Date(), -1),
    type: 'article',
  },
  {
    id: '4',
    title: 'CSS Architecture for Modern Web Apps',
    url: 'https://smashingmagazine.com/css-architecture',
    domain: 'smashingmagazine.com',
    excerpt: 'Best practices for organizing CSS in large-scale applications using Tailwind and CSS modules.',
    tags: ['t2', 't1'],
    collectionId: 'c4',
    isFavorite: false,
    isArchived: false,
    isRead: false,
    createdAt: newHZ(new Date(), -12),
    type: 'article',
  },
  {
    id: '5',
    title: 'The Psychology of Color in Marketing',
    url: 'https://psychologyxy.com/color-marketing',
    domain: 'psychologyxy.com',
    excerpt: 'How different colors evoke emotions and influence purchasing decisions.',
    tags: ['t1', 't5'],
    collectionId: 'c2',
    isFavorite: false,
    isArchived: true,
    isRead: true,
    createdAt: newHZ(new Date(), -20),
    readAt: newHZ(new Date(), -15),
    type: 'article',
  },
    {
    id: '6',
    title: 'Linear: A better way to build products',
    url: 'https://linear.app/method',
    domain: 'linear.app',
    excerpt: 'The principles and practices that drive high-performing product teams.',
    imageUrl: 'https://images.unsplash.com/photo-1683813479742-4730f91fa3ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwd29ya3NwYWNlJTIwY29kaW5nfGVufDF8fHx8MTc2ODk4MDUzOXww&ixlib=rb-4.1.0&q=80&w=1080',
    tags: ['t3', 't5'],
    collectionId: 'c3',
    isFavorite: true,
    isArchived: false,
    isRead: false,
    createdAt: newHZ(new Date(), -1),
    type: 'article',
  }
];

// Helper to subtract days
function newHZ(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
