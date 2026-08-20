# Spaced Repetition Engine (FSRS Model) - Lisan

## 1. Mathematical Foundation

Lisan uses the **Free Spaced Repetition Scheduler (FSRS)** algorithm based on the modern memory model of Stability ($S$), Difficulty ($D$), and Retrievability ($R$).

### Retrievability ($R$)
The probability of successfully recalling a card after $t$ elapsed days given memory stability $S$:
$$R(t, S) = \left(1 + \frac{t}{9 \cdot S}\right)^{-1}$$

### Initial Values ($S_0, D_0$)
When a new card is first graded:
- $S_0(G) = w[G-1]$
- $D_0(G) = w_4 - e^{w_5 \cdot (G - 1)} + 1$ (clamped to $[1.0, 10.0]$)

Where $G \in \{1: \text{Again}, 2: \text{Hard}, 3: \text{Good}, 4: \text{Easy}\}$.

### Difficulty Update ($D'$)
$$\Delta D = -w_6 \cdot (G - 3)$$
$$D' = w_7 \cdot D_0(3) + (1 - w_7) \cdot (D + \Delta D)$$
$$D' \leftarrow \min(\max(D', 1.0), 10.0)$$

### Stability Update on Recall ($G \ge 2$)
$$S'_{recall} = S \cdot \left(1 + e^{w_8} \cdot (11 - D) \cdot S^{-w_9} \cdot \left(e^{w_{10} \cdot (1 - R)} - 1\right) \cdot \text{penalty} \cdot \text{bonus}\right)$$

### Stability Update on Lapse ($G = 1$)
$$S'_{lapse} = w_{11} \cdot D^{-w_{12}} \cdot \left((S + 1)^{w_{13}} - 1\right) \cdot e^{w_{14} \cdot (1 - R)}$$

### Interval Calculation ($I$)
Given the user's desired target retention $R_d$ (default 90%):
$$I = 9 \cdot S \cdot \left(\frac{1}{R_d} - 1\right)$$

---

## 2. Intelligent Card Prioritization

Study queues are ordered dynamically using multi-factor priority scores:
$$\text{Priority} = \text{StateWeight} + 25 \cdot \left(\frac{\text{OverdueDays}}{\text{Interval}}\right) + 30 \cdot (1 - R) + 10 \cdot \left(\frac{D}{10}\right) + \min(3 \cdot \text{Lapses}, 30) + 2 \cdot \text{DeckPriority}$$

This guarantees that high-urgency forgetting risks and active learning items are studied first without starving new cards.
