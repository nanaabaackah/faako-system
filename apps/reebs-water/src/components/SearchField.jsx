import { SearchField as SharedSearchField } from "@faako/ui";
import { AppIcon } from "./AppIcon.jsx";
import { faSearch, faXmark } from "../icons/iconSet.js";

export default function SearchField({ className = "", ...props }) {
  return (
    <SharedSearchField
      {...props}
      className={`search-field ${className}`.trim()}
      renderSearchIcon={() => <AppIcon icon={faSearch} />}
      renderClearIcon={() => <AppIcon icon={faXmark} />}
    />
  );
}
