const dimensoes = {
    overworld: [
        'Plains', 'Sunflower Plains', 'Forest', 'Flower Forest', 'Birch Forest',
        'Old Growth Birch Forest', 'Dark Forest', 'Pale Garden', 'Taiga', 'Old Growth Pine Taiga',
        'Old Growth Spruce Taiga', 'Snowy Taiga', 'Snowy Plains', 'Ice Spikes',
        'Frozen River', 'Snowy Beach', 'Desert', 'Savanna', 'Savanna Plateau',
        'Windswept Savanna', 'Jungle', 'Sparse Jungle', 'Bamboo Jungle', 'Swamp',
        'Mangrove Swamp', 'Badlands', 'Eroded Badlands', 'Wooded Badlands', 'Meadow',
        'Cherry Grove', 'Grove', 'Snowy Slopes', 'Frozen Peaks', 'Jagged Peaks',
        'Stony Peaks', 'Windswept Hills', 'Windswept Gravelly Hills', 'Windswept Forest',
        'Stony Shore', 'River', 'Beach', 'Mushroom Fields', 'Ocean', 'Deep Ocean',
        'Cold Ocean', 'Deep Cold Ocean', 'Frozen Ocean', 'Deep Frozen Ocean',
        'Lukewarm Ocean', 'Deep Lukewarm Ocean', 'Warm Ocean', 'Lush Caves',
        'Dripstone Caves', 'Deep Dark'
    ],
    nether: ['Nether Wastes', 'Crimson Forest', 'Warped Forest', 'Soul Sand Valley', 'Basalt Deltas'],
    end: ['The End', 'End Highlands', 'End Midlands', 'Small End Islands', 'End Barrens']
};

const biomasMinecraft = Object.entries(dimensoes).flatMap(([dimensao, nomes]) =>
    nomes.map(nome => ({
        dimensao,
        nome,
        slug: nome.toLowerCase().replaceAll(' ', '_')
    }))
);

module.exports = { biomasMinecraft };
