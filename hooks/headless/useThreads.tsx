import { useMedplum } from "@medplum/react-hooks";
import { useEffect, useState } from "react";

import type { Thread } from "@/types/chat";
import { formatTimestamp } from "@/utils/datetime";

export function useThreads() {
  const medplum = useMedplum();
  const patient = medplum.getProfile() as Patient;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        // Find Communications that are threads (have partOf missing).
        // Use _revinclude to get the thread messages to get the last message:
        const searchResults = await medplum.search("Communication", {
          "part-of:missing": true,
          _revinclude: "Communication:part-of",
          _sort: "-sent",
          _count: "100",
        });

        const threadComms = searchResults.entry
          ?.filter((e) => e.search?.mode === "match")
          .map((e) => e.resource!);
        const formattedThreads =
          threadComms?.map((comm) => {
            const lastMessage = searchResults.entry
              ?.filter(
                (e) =>
                  e.search?.mode === "include" &&
                  e.resource?.partOf?.[0]?.reference === `Communication/${comm.id}`,
              )
              .sort((e1, e2) =>
                e1.resource?.sent && e2.resource?.sent
                  ? new Date(e2.resource.sent).getTime() - new Date(e1.resource.sent).getTime()
                  : 1,
              )?.[0]?.resource;
            return {
              id: comm.id!,
              topic: comm.payload?.[0]?.contentString || comm.id!,
              lastMessage: lastMessage?.payload?.[0]?.contentString,
              lastMessageTime: lastMessage?.sent
                ? formatTimestamp(new Date(lastMessage.sent))
                : undefined,
            };
          }) || [];

        setThreads(formattedThreads);
      } finally {
        setLoading(false);
      }
    };

    if (patient) {
      fetchThreads();
    }
  }, [medplum, patient]);

  return { threads, loading };
}
