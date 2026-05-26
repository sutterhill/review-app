import { useCallback, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router";

import { DiffView } from "../components/DiffView";
import { ChangedFileTree } from "../components/FileTree";
import type { AppDispatch } from "../store/store";
import { selectViewedFilesForPr } from "../store/viewed-files/viewed-files-selectors";
import { viewedFilesActions } from "../store/viewed-files/viewed-files-slice";
import { usePRContext } from "./pr-context";

export const DiffRoute = (): React.JSX.Element => {
  const { handleFileElement, handleFileSelect, prData, selectedFilePath, setSidebar } =
    usePRContext();
  const [searchParams] = useSearchParams();
  const targetFile = searchParams.get("file");

  useEffect(() => {
    if (!targetFile) return;
    handleFileSelect(targetFile);
  }, [targetFile, handleFileSelect]);

  const dispatch = useDispatch<AppDispatch>();
  const prReference = prData.metadata.reference;
  const viewedPaths = useSelector(selectViewedFilesForPr(prReference));
  const viewedSet = useMemo(() => new Set(viewedPaths), [viewedPaths]);
  const handleToggleViewed = useCallback(
    (path: string, viewed: boolean) => {
      dispatch(viewedFilesActions.setViewed({ path, prReference, viewed }));
    },
    [dispatch, prReference],
  );

  useEffect(() => {
    setSidebar(
      <ChangedFileTree
        files={prData.files}
        onSelect={handleFileSelect}
        selectedPath={selectedFilePath}
        viewedPaths={viewedSet}
      />,
    );
    return () => setSidebar(null);
  }, [handleFileSelect, prData.files, selectedFilePath, setSidebar, viewedSet]);

  return (
    <div className="p-4">
      <DiffView
        onFileElement={handleFileElement}
        onToggleViewed={handleToggleViewed}
        pullRequest={prData}
        viewedPaths={viewedSet}
      />
    </div>
  );
};
