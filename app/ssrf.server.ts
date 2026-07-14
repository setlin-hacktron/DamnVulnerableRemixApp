import dns from "dns";
import net from "net";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  const o1 = parseInt(parts[0], 10);
  const o2 = parseInt(parts[1], 10);
  const o3 = parseInt(parts[2], 10);
  const o4 = parseInt(parts[3], 10);

  if (isNaN(o1) || isNaN(o2) || isNaN(o3) || isNaN(o4)) return true;
  if (o1 < 0 || o1 > 255 || o2 < 0 || o2 > 255 || o3 < 0 || o3 > 255 || o4 < 0 || o4 > 255) return true;

  // Loopback (127.0.0.0/8)
  if (o1 === 127) return true;
  // Private (10.0.0.0/8)
  if (o1 === 10) return true;
  // Private (172.16.0.0/12)
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  // Private (192.168.0.0/16)
  if (o1 === 192 && o2 === 168) return true;
  // Link-local (169.254.0.0/16)
  if (o1 === 169 && o2 === 254) return true;
  // Multicast (224.0.0.0/4)
  if (o1 >= 224 && o1 <= 239) return true;
  // Unspecified (0.0.0.0)
  if (o1 === 0) return true;
  // Broadcast (255.255.255.255)
  if (o1 === 255 && o2 === 255 && o3 === 255 && o4 === 255) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const cleanIp = ip.toLowerCase().split("%")[0].trim();

  // IPv4-mapped IPv6 address (e.g. ::ffff:192.168.1.1)
  if (cleanIp.startsWith("::ffff:")) {
    const ipv4Part = cleanIp.substring(7);
    if (net.isIPv4(ipv4Part)) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  // Loopback (::1)
  if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;
  // Unspecified (::)
  if (cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true;
  // Unique Local Address (fc00::/7)
  if (cleanIp.startsWith("fc") || cleanIp.startsWith("fd")) return true;
  // Link-local (fe80::/10)
  if (/^fe[89ab]/i.test(cleanIp)) return true;
  // Multicast (ff00::/8)
  if (cleanIp.startsWith("ff")) return true;

  return false;
}

export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true;
}

export async function validateUrl(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr);

    // Only allow http: and https: protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname;
    if (!hostname) {
      return false;
    }

    // Resolve all addresses (IPv4 and IPv6)
    const addresses = await dns.promises.lookup(hostname, { all: true });

    // Check if any resolved address is private/local
    for (const addr of addresses) {
      if (isPrivateIP(addr.address)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
