import { TagManagement } from '../features/tags/components/TagManagement';

export function TagManagementPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Tag Management</h1>
      <TagManagement />
    </section>
  );
}
