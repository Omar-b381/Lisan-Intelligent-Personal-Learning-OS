import React from 'react';
import { useReadingStore } from '../stores/readingStore';
import { BookLibrary } from '../components/reading/BookLibrary';
import { BookReader } from '../components/reading/BookReader';

export const ReadingPage: React.FC = () => {
  const { activeBook } = useReadingStore();

  return (
    <div className="h-full">
      {activeBook ? <BookReader /> : <BookLibrary />}
    </div>
  );
};

export default ReadingPage;
