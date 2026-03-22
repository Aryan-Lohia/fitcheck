declare module "heic-convert" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convert: (opts: any) => Promise<ArrayBuffer | Buffer>;
  export default convert;
}
