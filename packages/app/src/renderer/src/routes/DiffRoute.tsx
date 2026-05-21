import { useEffect } from "react";

import { DiffView } from "../components/DiffView";
import { ChangedFileTree } from "../components/FileTree";
import { usePRContext } from "./pr-context";

export const DiffRoute = (): React.JSX.Element => {
  const { handleFileElement, handleFileSelect, prData, selectedFilePath, setSidebar } =
    usePRContext();

  useEffect(() => {
    setSidebar(
      <ChangedFileTree
        files={prData.files}
        onSelect={handleFileSelect}
        selectedPath={selectedFilePath}
      />,
    );
    return () => setSidebar(null);
  }, [handleFileSelect, prData.files, selectedFilePath, setSidebar]);

  return (
    <div className="p-4">
      <DiffView onFileElement={handleFileElement} pullRequest={prData} />
    </div>
  );
};
