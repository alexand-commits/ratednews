// /rankings was a near-duplicate of /outlets — permanent redirect.
export async function getServerSideProps() {
  return { redirect: { destination: '/outlets', permanent: true } }
}
export default function Rankings() { return null }
