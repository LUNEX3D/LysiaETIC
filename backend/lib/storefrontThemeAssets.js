"use strict";

/** Unsplash görsel URL — sabit, telif dostu vitrin fotoğrafları */
function unsplash(photoId, w = 800, h = 800) {
    return `https://images.unsplash.com/${photoId}?w=${w}&h=${h}&fit=crop&q=85&auto=format`;
}

function avatar(seed, size = 80) {
    return `https://i.pravatar.cc/${size}?img=${seed}`;
}

const POOLS = {
    beauty: {
        hero: "photo-1596462502278-27bfdc403348",
        split: "photo-1522335789203-aabd1fc54bc9",
        contactMap: "photo-1486406146926-c627a92ad1ab",
        products: [
            "photo-1556228720-195a672e8a03", "photo-1571781926291-c477ebfd024b",
            "photo-1620916564558-0b21d692f2c6", "photo-1612817288484-6f916006741a",
            "photo-1586495777744-4413f2102fad", "photo-1522338242992-e1a54906a8da",
            "photo-1608248543801-ba43f4a670b5", "photo-1598440947619-2a35b251aa35",
            "photo-1570194065650-d99fb4d3c8fd", "photo-1556228578-0d85b1a4d571",
            "photo-1616394584738-fc6e612e71b9", "photo-1596755389378-c31d21fd1273",
        ],
        collections: [
            "photo-1570554888281-e3d4c5e8c2d1", "photo-1487412947147-5cebf100ffc2",
            "photo-1527798200293-d936b462d935", "photo-1592945403244-b3fbafd7f2c4",
            "photo-1512496015851-a90fb38ba796", "photo-1560066984-138d9834c703",
            "photo-1608571423902-eed4a5ad8108", "photo-1615485925510-7ce888f0a585",
        ],
        blog: [
            "photo-1616394584738-fc6e612e71b9", "photo-1487412947147-5cebf100ffc2",
            "photo-1556228578-0d85b1a4d571", "photo-1570554888281-e3d4c5e8c2d1",
            "photo-1596462502278-27bfdc403348", "photo-1522335789203-aabd1fc54bc9",
        ],
        gallery: [
            "photo-1596462502278-27bfdc403348", "photo-1522335789203-aabd1fc54bc9",
            "photo-1571781926291-c477ebfd024b", "photo-1612817288484-6f916006741a",
            "photo-1556228720-195a672e8a03", "photo-1586495777744-4413f2102fad",
        ],
    },
    fashion: {
        hero: "photo-1483985988355-763728e1935b",
        split: "photo-1469334031218-e382a71b716b",
        contactMap: "photo-1441986300917-64674bd600d8",
        products: [
            "photo-1434389677669-e08b4cac3105", "photo-1496747611176-843222e1e57c",
            "photo-1521572163474-6864f9cf17ab", "photo-1543163521-1bf539c55dd2",
            "photo-1551028719-00167b16eac5", "photo-1594938298603-c8148c4dae35",
            "photo-1591047139829-d91aecb6caea", "photo-1509631179647-0177331693ae",
            "photo-1515372039744-b8f02a3ae446", "photo-1552374196-c4ebd7a0f325",
            "photo-1583743814966-8936f5b7be0a", "photo-1617137968427-85924c800a22",
        ],
        collections: [
            "photo-1483985988355-763728e1935b", "photo-1496747611176-843222e1e57c",
            "photo-1469334031218-e382a71b716b", "photo-1552374196-c4ebd7a0f325",
            "photo-1515372039744-b8f02a3ae446", "photo-1594938298603-c8148c4dae35",
            "photo-1509631179647-0177331693ae", "photo-1583743814966-8936f5b7be0a",
        ],
        blog: [
            "photo-1469334031218-e382a71b716b", "photo-1483985988355-763728e1935b",
            "photo-1496747611176-843222e1e57c", "photo-1515372039744-b8f02a3ae446",
            "photo-1552374196-c4ebd7a0f325", "photo-1594938298603-c8148c4dae35",
        ],
        gallery: [
            "photo-1483985988355-763728e1935b", "photo-1496747611176-843222e1e57c",
            "photo-1469334031218-e382a71b716b", "photo-1515372039744-b8f02a3ae446",
            "photo-1552374196-c4ebd7a0f325", "photo-1594938298603-c8148c4dae35",
        ],
    },
    electronics: {
        hero: "photo-1498049794561-7780e7231661",
        split: "photo-1526738549139-ee5454e27d70",
        contactMap: "photo-1519389950473-47ba0277781c",
        products: [
            "photo-1505740420928-5e560c06d30e", "photo-1523275335684-37898b6baf30",
            "photo-1572569511254-d8f5fe5c922c", "photo-1587825140708-dfaf72ae4b04",
            "photo-1593642632823-8f785ba67e45", "photo-1527814050087-3793815479db",
            "photo-1546868871-7041f82a55f4", "photo-1606144042614-bcd7bae57d68",
            "photo-1618384888359-22da3d1723ad", "photo-1625948515291-69613efd344f",
            "photo-1631549916768-4119b2d0285c", "photo-1583394838336-acd977736f90",
        ],
        collections: [
            "photo-1498049794561-7780e7231661", "photo-1526738549139-ee5454e27d70",
            "photo-1518770660439-4636190af475", "photo-1550009158-9ebf69173e03",
            "photo-1593642632823-8f785ba67e45", "photo-1587825140708-dfaf72ae4b04",
            "photo-1523275335684-37898b6baf30", "photo-1505740420928-5e560c06d30e",
        ],
        blog: [
            "photo-1518770660439-4636190af475", "photo-1498049794561-7780e7231661",
            "photo-1526738549139-ee5454e27d70", "photo-1550009158-9ebf69173e03",
            "photo-1593642632823-8f785ba67e45", "photo-1587825140708-dfaf72ae4b04",
        ],
        gallery: [
            "photo-1498049794561-7780e7231661", "photo-1505740420928-5e560c06d30e",
            "photo-1523275335684-37898b6baf30", "photo-1518770660439-4636190af475",
            "photo-1593642632823-8f785ba67e45", "photo-1526738549139-ee5454e27d70",
        ],
    },
    food: {
        hero: "photo-1542838132-92c53300491e",
        split: "photo-1498837167922-ddd27525cd27",
        contactMap: "photo-1556910103-1c02745aae4d",
        products: [
            "photo-1542838132-92c53300491e", "photo-1610348728811-84380dd1d4d6",
            "photo-1509440159596-0249088772ff", "photo-1511690656952-34342bb7c2fb2",
            "photo-1563636619-e9143da7973b", "photo-1587049352846-4a222e784422",
            "photo-1550583724-b2692b85b469", "photo-1594282486552-05b4d929f38a",
            "photo-1601004890684-d8cbf643f5f2", "photo-1603048297172-c92544798d5a",
            "photo-1606312619070-d48b4c652a52", "photo-1610832958506-aa56368176cf",
        ],
        collections: [
            "photo-1542838132-92c53300491e", "photo-1610832958506-aa56368176cf",
            "photo-1498837167922-ddd27525cd27", "photo-1563636619-e9143da7973b",
            "photo-1511690656952-34342bb7c2fb2", "photo-1587049352846-4a222e784422",
            "photo-1550583724-b2692b85b469", "photo-1601004890684-d8cbf643f5f2",
        ],
        blog: [
            "photo-1498837167922-ddd27525cd27", "photo-1542838132-92c53300491e",
            "photo-1556910103-1c02745aae4d", "photo-1563636619-e9143da7973b",
            "photo-1610832958506-aa56368176cf", "photo-1587049352846-4a222e784422",
        ],
        gallery: [
            "photo-1542838132-92c53300491e", "photo-1498837167922-ddd27525cd27",
            "photo-1563636619-e9143da7973b", "photo-1610832958506-aa56368176cf",
            "photo-1511690656952-34342bb7c2fb2", "photo-1601004890684-d8cbf643f5f2",
        ],
    },
    furniture: {
        hero: "photo-1555041469-a586c61ea9bc",
        split: "photo-1618221195710-dd6b41faaea6",
        contactMap: "photo-1616486338812-3dadae4b4ace",
        products: [
            "photo-1555041469-a586c61ea9bc", "photo-1618221195710-dd6b41faaea6",
            "photo-1586023492125-27b2c045efd7", "photo-1615529328331-f8917597711f",
            "photo-1631049307264-da0ec9d70304", "photo-1592078615290-033ee584e267",
            "photo-1567538096631-e23c955d3991", "photo-1617098917768-30654cece112",
            "photo-1507473885765-e6ed057f782c", "photo-1615874959474-d609969a20ed",
            "photo-1598300042247-d088f8ab3a91", "photo-1615529328331-f8917597711f",
        ],
        collections: [
            "photo-1555041469-a586c61ea9bc", "photo-1618221195710-dd6b41faaea6",
            "photo-1586023492125-27b2c045efd7", "photo-1616486338812-3dadae4b4ace",
            "photo-1592078615290-033ee584e267", "photo-1567538096631-e23c955d3991",
            "photo-1507473885765-e6ed057f782c", "photo-1617098917768-30654cece112",
        ],
        blog: [
            "photo-1618221195710-dd6b41faaea6", "photo-1555041469-a586c61ea9bc",
            "photo-1616486338812-3dadae4b4ace", "photo-1586023492125-27b2c045efd7",
            "photo-1592078615290-033ee584e267", "photo-1567538096631-e23c955d3991",
        ],
        gallery: [
            "photo-1555041469-a586c61ea9bc", "photo-1618221195710-dd6b41faaea6",
            "photo-1616486338812-3dadae4b4ace", "photo-1586023492125-27b2c045efd7",
            "photo-1592078615290-033ee584e267", "photo-1507473885765-e6ed057f782c",
        ],
    },
    kids: {
        hero: "photo-1503454537198-1aeabb1726e9",
        split: "photo-1515488042361-ee00e317997c",
        contactMap: "photo-1503454537198-1aeabb1726e9",
        products: [
            "photo-1515488042361-ee00e317997c", "photo-1503454537198-1aeabb1726e9",
            "photo-1587654780291-39bf9406373b", "photo-1566576912321-d58ddd7a6088",
            "photo-1558061815-0c18a4addbc8", "photo-1596464716127-f2a82984de30",
            "photo-1586281380349-632531db7ed4", "photo-1516627145497-ae6968895b74",
            "photo-1530549387789-4c1017266635", "photo-1581833971358-2c8b55087ead",
            "photo-1566576912321-d58ddd7a6088", "photo-1596464716127-f2a82984de30",
        ],
        collections: [
            "photo-1503454537198-1aeabb1726e9", "photo-1515488042361-ee00e317997c",
            "photo-1587654780291-39bf9406373b", "photo-1566576912321-d58ddd7a6088",
            "photo-1558061815-0c18a4addbc8", "photo-1596464716127-f2a82984de30",
            "photo-1586281380349-632531db7ed4", "photo-1516627145497-ae6968895b74",
        ],
        blog: [
            "photo-1515488042361-ee00e317997c", "photo-1503454537198-1aeabb1726e9",
            "photo-1587654780291-39bf9406373b", "photo-1566576912321-d58ddd7a6088",
            "photo-1558061815-0c18a4addbc8", "photo-1596464716127-f2a82984de30",
        ],
        gallery: [
            "photo-1503454537198-1aeabb1726e9", "photo-1515488042361-ee00e317997c",
            "photo-1587654780291-39bf9406373b", "photo-1566576912321-d58ddd7a6088",
            "photo-1558061815-0c18a4addbc8", "photo-1596464716127-f2a82984de30",
        ],
    },
    pet: {
        hero: "photo-1450778869180-41d0601e046e",
        split: "photo-1587300003388-59208cc962cb",
        contactMap: "photo-1450778869180-41d0601e046e",
        products: [
            "photo-1587300003388-59208cc962cb", "photo-1450778869180-41d0601e046e",
            "photo-1548199973-03cce0bbc87b", "photo-1514888286974-6c03e2ca1dba",
            "photo-1530281700549-e82e7bf110d6", "photo-1583511655857-d19b40a7a54e",
            "photo-1592194996308-7b43878e84a6", "photo-1574158622682-ec40b6969a24",
            "photo-1543466835-00a7907e9de1", "photo-1583337130417-3346a118be11",
            "photo-1514888286974-6c03e2ca1dba", "photo-1548199973-03cce0bbc87b",
        ],
        collections: [
            "photo-1450778869180-41d0601e046e", "photo-1587300003388-59208cc962cb",
            "photo-1514888286974-6c03e2ca1dba", "photo-1548199973-03cce0bbc87b",
            "photo-1530281700549-e82e7bf110d6", "photo-1583511655857-d19b40a7a54e",
            "photo-1592194996308-7b43878e84a6", "photo-1574158622682-ec40b6969a24",
        ],
        blog: [
            "photo-1450778869180-41d0601e046e", "photo-1587300003388-59208cc962cb",
            "photo-1514888286974-6c03e2ca1dba", "photo-1548199973-03cce0bbc87b",
            "photo-1530281700549-e82e7bf110d6", "photo-1583511655857-d19b40a7a54e",
        ],
        gallery: [
            "photo-1450778869180-41d0601e046e", "photo-1587300003388-59208cc962cb",
            "photo-1514888286974-6c03e2ca1dba", "photo-1548199973-03cce0bbc87b",
            "photo-1530281700549-e82e7bf110d6", "photo-1574158622682-ec40b6969a24",
        ],
    },
};

POOLS.sports = {
    hero: "photo-1461896836934-ffe607ba8121",
    split: "photo-1571902943202-507ec2618e8f",
    contactMap: "photo-1534438327276-14e5300c3a48",
    products: [
        "photo-1542291026-7eec264c27ff", "photo-1460353581641-37baddab0fa0",
        "photo-1571902943202-507ec2618e8f", "photo-1517836357463-d25dfeac3438",
        "photo-1434389677669-e08b4cac3105", "photo-1556906781-9a412961c28c",
        "photo-1595950653106-6c9ebd614d3a", "photo-1521572163474-6864f9cf17ab",
        "photo-1571019613454-1cb2f99b2d8b", "photo-1518611012118-696072aa579a",
        "photo-1553062407-98eeb64c6a62", "photo-1620799140408-edc6dcb6d633",
    ],
    collections: [
        "photo-1461896836934-ffe607ba8121", "photo-1571902943202-507ec2618e8f",
        "photo-1542291026-7eec264c27ff", "photo-1517836357463-d25dfeac3438",
        "photo-1556906781-9a412961c28c", "photo-1595950653106-6c9ebd614d3a",
        "photo-1571019613454-1cb2f99b2d8b", "photo-1518611012118-696072aa579a",
    ],
    blog: [
        "photo-1461896836934-ffe607ba8121", "photo-1571902943202-507ec2618e8f",
        "photo-1542291026-7eec264c27ff", "photo-1517836357463-d25dfeac3438",
        "photo-1556906781-9a412961c28c", "photo-1571019613454-1cb2f99b2d8b",
    ],
    gallery: [
        "photo-1461896836934-ffe607ba8121", "photo-1542291026-7eec264c27ff",
        "photo-1571902943202-507ec2618e8f", "photo-1517836357463-d25dfeac3438",
        "photo-1556906781-9a412961c28c", "photo-1595950653106-6c9ebd614d3a",
    ],
};

POOLS.jewelry = {
    hero: "photo-1515562141203-75312f865130",
    split: "photo-1605100804763-247f67b3557e",
    contactMap: "photo-1515562141203-75312f865130",
    products: [
        "photo-1605100804763-247f67b3557e", "photo-1515562141203-75312f865130",
        "photo-1611591432721-58b64a54742a", "photo-1599643478518-a784e890dcdb",
        "photo-1535632066922-ab3c3ab39806", "photo-1603561591414-0716e1319a1a",
        "photo-1573408301185-9146fe634ad0", "photo-1611591432721-58b64a54742a",
        "photo-1602751584552-8ba73aaedd8c", "photo-1515562141203-75312f865130",
        "photo-1599643478518-a784e890dcdb", "photo-1535632066922-ab3c3ab39806",
    ],
    collections: [
        "photo-1515562141203-75312f865130", "photo-1605100804763-247f67b3557e",
        "photo-1611591432721-58b64a54742a", "photo-1599643478518-a784e890dcdb",
        "photo-1535632066922-ab3c3ab39806", "photo-1603561591414-0716e1319a1a",
        "photo-1573408301185-9146fe634ad0", "photo-1602751584552-8ba73aaedd8c",
    ],
    blog: [
        "photo-1515562141203-75312f865130", "photo-1605100804763-247f67b3557e",
        "photo-1611591432721-58b64a54742a", "photo-1599643478518-a784e890dcdb",
        "photo-1535632066922-ab3c3ab39806", "photo-1603561591414-0716e1319a1a",
    ],
    gallery: [
        "photo-1515562141203-75312f865130", "photo-1605100804763-247f67b3557e",
        "photo-1611591432721-58b64a54742a", "photo-1599643478518-a784e890dcdb",
        "photo-1535632066922-ab3c3ab39806", "photo-1573408301185-9146fe634ad0",
    ],
};

POOLS.luxury = {
    hero: "photo-1490481651871-ab68de25d43d",
    split: "photo-1445205170230-053b83016050",
    contactMap: "photo-1441986300917-64674bd600d8",
    products: [
        "photo-1490481651871-ab68de25d43d", "photo-1445205170230-053b83016050",
        "photo-1553062407-98eeb64c6a62", "photo-1584917865442-de89a76d0630",
        "photo-1548036328-c9fa89d128fa", "photo-1590874103328-eac3a4718146",
        "photo-1521572163474-6864f9cf17ab", "photo-1552374196-c4ebd7a0f325",
        "photo-1594938298603-c8148c4dae35", "photo-1509631179647-0177331693ae",
        "photo-1583743814966-8936f5b7be0a", "photo-1617137968427-85924c800a22",
    ],
    collections: [
        "photo-1490481651871-ab68de25d43d", "photo-1445205170230-053b83016050",
        "photo-1553062407-98eeb64c6a62", "photo-1584917865442-de89a76d0630",
        "photo-1548036328-c9fa89d128fa", "photo-1590874103328-eac3a4718146",
        "photo-1521572163474-6864f9cf17ab", "photo-1552374196-c4ebd7a0f325",
    ],
    blog: [
        "photo-1490481651871-ab68de25d43d", "photo-1445205170230-053b83016050",
        "photo-1553062407-98eeb64c6a62", "photo-1584917865442-de89a76d0630",
        "photo-1548036328-c9fa89d128fa", "photo-1590874103328-eac3a4718146",
    ],
    gallery: [
        "photo-1490481651871-ab68de25d43d", "photo-1445205170230-053b83016050",
        "photo-1553062407-98eeb64c6a62", "photo-1584917865442-de89a76d0630",
        "photo-1548036328-c9fa89d128fa", "photo-1590874103328-eac3a4718146",
    ],
};

POOLS.digital = {
    hero: "photo-1460925895917-afdab827c52f",
    split: "photo-1551288049-bebda4e38f71",
    contactMap: "photo-1519389950473-47ba0277781c",
    products: [
        "photo-1460925895917-afdab827c52f", "photo-1551288049-bebda4e38f71",
        "photo-1517694712202-8dd079825f90", "photo-1498050108023-c5249f4df085",
        "photo-1555066931-4365d14bab8c", "photo-1555949963-aa79dcee981c",
        "photo-1504639725590-34d0984388bd", "photo-1516321318423-f06f85e504b3",
        "photo-1551650975-87deedd944c3", "photo-1516321497487-e288fb19713f",
        "photo-1531482045836-75989edf2e4e", "photo-1522071820081-009f0129c71c",
    ],
    collections: [
        "photo-1460925895917-afdab827c52f", "photo-1551288049-bebda4e38f71",
        "photo-1517694712202-8dd079825f90", "photo-1498050108023-c5249f4df085",
        "photo-1555066931-4365d14bab8c", "photo-1555949963-aa79dcee981c",
        "photo-1504639725590-34d0984388bd", "photo-1516321318423-f06f85e504b3",
    ],
    blog: [
        "photo-1460925895917-afdab827c52f", "photo-1551288049-bebda4e38f71",
        "photo-1517694712202-8dd079825f90", "photo-1498050108023-c5249f4df085",
        "photo-1555066931-4365d14bab8c", "photo-1555949963-aa79dcee981c",
    ],
    gallery: [
        "photo-1460925895917-afdab827c52f", "photo-1551288049-bebda4e38f71",
        "photo-1517694712202-8dd079825f90", "photo-1498050108023-c5249f4df085",
        "photo-1555066931-4365d14bab8c", "photo-1504639725590-34d0984388bd",
    ],
};

POOLS.marketplace = {
    hero: "photo-1556742049-0cfed4f6a45d",
    split: "photo-1556742111-a8365738f207",
    contactMap: "photo-1556742049-0cfed4f6a45d",
    products: [
        "photo-1505740420928-5e560c06d30e", "photo-1542838132-92c53300491e",
        "photo-1521572163474-6864f9cf17ab", "photo-1593642632823-8f785ba67e45",
        "photo-1587654780291-39bf9406373b", "photo-1542291026-7eec264c27ff",
        "photo-1507473885765-e6ed057f782c", "photo-1571019613454-1cb2f99b2d8b",
        "photo-1556228720-195a672e8a03", "photo-1523275335684-37898b6baf30",
        "photo-1556906781-9a412961c28c", "photo-1516321318423-f06f85e504b3",
    ],
    collections: [
        "photo-1556742049-0cfed4f6a45d", "photo-1556742111-a8365738f207",
        "photo-1505740420928-5e560c06d30e", "photo-1542838132-92c53300491e",
        "photo-1521572163474-6864f9cf17ab", "photo-1593642632823-8f785ba67e45",
        "photo-1587654780291-39bf9406373b", "photo-1542291026-7eec264c27ff",
    ],
    blog: [
        "photo-1556742049-0cfed4f6a45d", "photo-1556742111-a8365738f207",
        "photo-1505740420928-5e560c06d30e", "photo-1542838132-92c53300491e",
        "photo-1521572163474-6864f9cf17ab", "photo-1593642632823-8f785ba67e45",
    ],
    gallery: [
        "photo-1556742049-0cfed4f6a45d", "photo-1556742111-a8365738f207",
        "photo-1505740420928-5e560c06d30e", "photo-1542838132-92c53300491e",
        "photo-1521572163474-6864f9cf17ab", "photo-1593642632823-8f785ba67e45",
    ],
};

POOLS.general = POOLS.fashion;

const TEAM_AVATARS = [12, 32, 47];
const REVIEW_AVATARS = [5, 11, 9];

function getThemeAssets(verticalKey) {
    const pool = POOLS[verticalKey] || POOLS.general;
    return {
        hero: unsplash(pool.hero, 900, 700),
        split: unsplash(pool.split, 800, 600),
        contactMap: unsplash(pool.contactMap, 800, 400),
        products: pool.products.map((id) => unsplash(id, 600, 600)),
        collections: pool.collections.map((id) => unsplash(id, 500, 625)),
        blog: pool.blog.map((id) => unsplash(id, 800, 450)),
        gallery: pool.gallery.map((id) => unsplash(id, 400, 400)),
        team: TEAM_AVATARS.map((n, i) => ({
            img: avatar(n, 120),
            name: ["Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir"][i],
            role: ["Kurucu & CEO", "Operasyon Müdürü", "Müşteri Deneyimi"][i],
        })),
        reviews: REVIEW_AVATARS.map((n, i) => ({
            img: avatar(n, 64),
            name: ["Ayşe K.", "Mehmet T.", "Zeynep A."][i],
            text: [
                "Ürün kalitesi ve teslimat hızı mükemmel. Kesinlikle tavsiye ederim.",
                "Mobil deneyim çok akıcı, ödeme adımı saniyeler sürdü.",
                "Müşteri hizmetleri gerçekten 7/24 yardımcı oluyor.",
            ][i],
            stars: ["★★★★★", "★★★★★", "★★★★☆"][i],
        })),
    };
}

module.exports = {
    unsplash,
    avatar,
    getThemeAssets,
};
