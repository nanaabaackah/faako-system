import { useEffect } from "react";

const usePageTitle = (page: string) => {
  useEffect(() => {
    document.title = `Stroane | ${page}`;
    return () => {
      document.title = "Stroane";
    };
  }, [page]);
};

export default usePageTitle;
