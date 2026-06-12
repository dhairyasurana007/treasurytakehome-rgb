import BatchJobViewComponent from "@/components/batch-job-view";

export default async function BatchJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <BatchJobViewComponent jobId={jobId} />;
}
